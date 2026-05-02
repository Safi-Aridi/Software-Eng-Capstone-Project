import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant for the Lebanese National Passport Issuance System (NPIS).
Your job is to guide citizens through the passport application process.
You can help with:

Explaining what documents are required (Lebanese ID card or Civil Registry Extract issued within 3 months, passport photo with white background, old passport for renewals)
Explaining the application steps (identity verification → application form → biometric capture for new passports → payment via CashPlus → processing → delivery via LibanPost)
Explaining passport validity options (5 years: 200,000 LBP, 10 years: 350,000 LBP)
Explaining application statuses (Pending Review, Verified, Mukhtar Signed, Processed for Issuance, Delivered, Resubmission Required)
Explaining what Resubmission Required means and how to fix it
Explaining the payment process via CashPlus
Explaining delivery via LibanPost

Rules:

Keep responses concise (2-4 sentences max unless a list is genuinely helpful)
Never ask for personal data, passwords, or document contents
If asked about anything unrelated to the passport system, politely redirect: "I'm only able to help with passport application questions."
Always be polite and professional
Respond in the same language the user writes in (Arabic or English)`;

const QUICK_REPLIES = [
  "What documents do I need?",
  "How long does it take?",
  "What does 'Resubmission Required' mean?",
];

const HISTORY_LIMIT = 10;
const TIMEOUT_MS = 5000;

const AiAssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const newHistory = [...messages, userMsg].slice(-HISTORY_LIMIT);
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newHistory,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const reply: string =
        data?.content?.find((b: { type: string }) => b.type === "text")?.text ??
        "Sorry, I couldn't generate a response.";

      setMessages((prev) =>
        [...prev, { role: "assistant" as const, content: reply }].slice(
          -HISTORY_LIMIT,
        ),
      );
    } catch {
      clearTimeout(timeoutId);
      setMessages((prev) =>
        [
          ...prev,
          {
            role: "assistant" as const,
            content:
              "I'm having trouble connecting. Please try again in a moment.",
          },
        ].slice(-HISTORY_LIMIT),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 px-5 py-3 animate-pulse"
        aria-label="Open NPIS Assistant"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="text-sm font-medium">Help</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-200"
      style={{ width: 380, height: 520 }}
    >
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
            N
          </div>
          <h3 className="font-semibold text-sm">NPIS Assistant</h3>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-white hover:text-gray-200 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Messages thread */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
      >
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <AssistantAvatar />
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 max-w-[80%]">
                Hi! I'm the NPIS Assistant. How can I help with your passport
                application today?
              </div>
            </div>
            <div className="space-y-2 pt-2">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="block w-full text-left text-xs px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <AssistantAvatar />
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 max-w-[80%] whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ),
        )}

        {loading && (
          <div className="flex items-start gap-2">
            <AssistantAvatar />
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Type your question..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

const AssistantAvatar = () => (
  <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
    N
  </div>
);

export default AiAssistantWidget;
