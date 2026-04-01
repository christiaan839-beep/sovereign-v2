import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { whitelabelConfig } from '@/db/schema';
import { auditLog } from '@/lib/audit-log';
import { createLogger } from '@/lib/logger';

const log = createLogger('provisioning');
const VERCEL_API_URL = 'https://api.vercel.com';
const SOURCE_REPO = 'christiaan839-beep/sovereign-matrix'; // The master template

export async function POST(req: Request) {
  try {
    // Authentication required — only signed-in users on Enterprise plan can provision
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required for Enterprise Provisioning' }, { status: 401 });
    }

    const body = await req.json();
    const { userEmail, agencyName, requestedDomain } = body;

    if (!userEmail || !agencyName) {
      return NextResponse.json({ error: 'Missing required fields for Enterprise Provisioning' }, { status: 400 });
    }

    const vercelToken = process.env.VERCEL_ACCESS_TOKEN;
    if (!vercelToken) {
      return NextResponse.json({ 
        error: 'Vercel API token missing. Commander must authorize VERCEL_ACCESS_TOKEN via the deployment environment.' 
      }, { status: 500 });
    }

    const projectSlug = agencyName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    // 1. Create the Vercel Project
    const createProjectRes = await fetch(`${VERCEL_API_URL}/v10/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectSlug,
        framework: 'nextjs',
        serverlessFunctionRegion: 'iad1', // default US East or wro1 for EU/Africa
        gitRepository: {
          type: 'github',
          repo: SOURCE_REPO
        },
        environmentVariables: [
            {
                key: 'NEXT_PUBLIC_AGENCY_NAME',
                value: agencyName,
                type: 'plain',
                target: ['production', 'preview', 'development']
            },
            {
                key: 'DATABASE_URL',
                value: process.env.DATABASE_URL || '',
                type: 'encrypted',
                target: ['production', 'preview', 'development']
            },
            // Inject Nemotron / OpenClaw routing keys here
            {
                key: 'NVIDIA_NIM_API_KEY',
                value: process.env.NVIDIA_NIM_API_KEY || '',
                type: 'encrypted',
                target: ['production']
            }
        ]
      })
    });

    if (!createProjectRes.ok) {
      const errorData = await createProjectRes.json();
      return NextResponse.json({ error: 'Failed to provision Vercel project', details: errorData }, { status: createProjectRes.status });
    }

    const projectData = await createProjectRes.json();

    // 2. Assign Domain (if requested)
    if (requestedDomain) {
        await fetch(`${VERCEL_API_URL}/v10/projects/${projectData.id}/domains`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vercelToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: requestedDomain
            })
        });
    }

    // 3. Update the Database Record
    await db.insert(whitelabelConfig).values({
        userEmail,
        agencyName,
        domain: requestedDomain || `${projectSlug}.vercel.app`,
        tenantId: projectData.id
    }).onConflictDoUpdate({
        target: whitelabelConfig.userEmail,
        set: { 
            agencyName, 
            domain: requestedDomain || `${projectSlug}.vercel.app`,
            tenantId: projectData.id,
            updatedAt: new Date()
        }
    });

    await auditLog({
      userId: userId,
      action: "admin.provision",
      resource: projectData.id,
      details: { agencyName, domain: requestedDomain || `${projectSlug}.vercel.app`, userEmail },
    });

    return NextResponse.json({
      success: true,
      message: 'Enterprise Node Provisioned',
      projectId: projectData.id,
      url: `https://${projectSlug}.vercel.app`
    });

  } catch (error) {
    log.error('Enterprise Provisioning Fault:', error as Record<string, unknown>);
    return NextResponse.json({ error: 'Internal Server Error', details: (error as Error).message }, { status: 500 });
  }
}
