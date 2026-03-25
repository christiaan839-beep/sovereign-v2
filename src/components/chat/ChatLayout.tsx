"use client";

import { AnimatePresence } from "framer-motion";
import { ChatProvider, useChatContext } from "./ChatProvider";
import { ConversationTabs } from "./ConversationTabs";
import { AgentStatusStrip } from "./AgentStatusStrip";
import { SystemPromptEditor } from "./SystemPromptEditor";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { getSystemPrompt } from "@/lib/system-prompts";

function ChatLayoutInner() {
  const {
    messages,
    conversations,
    activeConversationId,
    selectedModel,
    loading,
    activeAgent,
    previewContent,
    agentHistory,
    promptEditorOpen,
    sendMessage,
    selectConversation,
    newConversation,
    closeConversation,
    setModel,
    submitFeedback,
    setPreviewContent,
    setPromptEditorOpen,
    updateSystemPrompt,
    activeConversation,
  } = useChatContext();

  return (
    <div className="h-screen flex bg-[#050505]">
      {/* Chat area */}
      <div className={`flex flex-col transition-all duration-300 ${previewContent ? "w-full lg:w-[60%]" : "w-full"}`}>
        <ConversationTabs
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectConversation}
          onNew={newConversation}
          onClose={closeConversation}
        />

        <AgentStatusStrip history={agentHistory} activeAgent={activeAgent} />

        <SystemPromptEditor
          prompt={activeConversation?.systemPrompt || getSystemPrompt("general")}
          onChange={updateSystemPrompt}
          isOpen={promptEditorOpen}
          onToggle={() => setPromptEditorOpen(!promptEditorOpen)}
        />

        <MessageList
          messages={messages}
          loading={loading}
          activeAgent={activeAgent}
          onSend={sendMessage}
          submitFeedback={submitFeedback}
        />

        <InputBar loading={loading} selectedModel={selectedModel} onModelChange={setModel} onSend={sendMessage} />
      </div>

      {/* Artifact / Preview panel */}
      <AnimatePresence>
        {previewContent && (
          <div className="hidden lg:block w-[40%]">
            <ArtifactPanel artifacts={[previewContent]} onClose={() => setPreviewContent(null)} />
          </div>
        )}
      </AnimatePresence>

      {/* Mobile overlay for artifact panel */}
      <AnimatePresence>
        {previewContent && (
          <div className="fixed inset-0 z-50 lg:hidden bg-[#050505]">
            <ArtifactPanel artifacts={[previewContent]} onClose={() => setPreviewContent(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatLayout() {
  return (
    <ChatProvider>
      <ChatLayoutInner />
    </ChatProvider>
  );
}
