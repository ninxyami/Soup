"use client";
interface ToastProps {
  msg: string;
  type?: "success" | "error" | "info";
}

export default function Toast({ msg, type = "info" }: ToastProps) {
  const color = type === "success" ? "border-success text-success" : type === "error" ? "border-danger text-danger" : "border-accent text-accent";
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`toast-slide px-5 py-3 font-mono text-xs border-l-[3px] bg-surface ${color}`}>
        {msg}
      </div>
    </div>
  );
}
