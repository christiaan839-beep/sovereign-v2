import { useEffect, useState } from "react";

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () =>
      setMobile(window.innerWidth < 768 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}
