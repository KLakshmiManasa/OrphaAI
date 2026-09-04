import { useEffect } from "react";

const TARS_AGENT_URL = "https://agent.hellotars.com/conv/s_oIBs";

export default function OrphaAIChatbot({ isOpen, onToggle, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <style>{`
        .orpha-chat-widget {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 100;
          font-family: Segoe UI, system-ui, sans-serif;
        }

        .orpha-chat-panel {
          position: absolute;
          right: 0;
          bottom: 78px;
          width: min(380px, calc(100vw - 28px));
          height: min(600px, calc(100vh - 118px));
          background: #ffffff;
          border: 1px solid #DADDD8;
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(4, 44, 83, 0.24);
          overflow: hidden;
          transform: translateY(12px) scale(0.96);
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms ease, transform 180ms ease;
        }

        .orpha-chat-panel.is-open {
          transform: translateY(0) scale(1);
          opacity: 1;
          pointer-events: auto;
        }

        .orpha-chat-header {
          height: 52px;
          padding: 0 12px 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: linear-gradient(135deg, #0F6E56 0%, #22A7B8 100%);
          color: #ffffff;
        }

        .orpha-chat-title {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          font-weight: 800;
          font-size: 14px;
        }

        .orpha-chat-status {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #E1F5EE;
          box-shadow: 0 0 0 3px rgba(225, 245, 238, 0.24);
          flex: 0 0 auto;
        }

        .orpha-chat-close,
        .orpha-chat-button {
          border: none;
          cursor: pointer;
          font: inherit;
        }

        .orpha-chat-close {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-size: 20px;
          line-height: 1;
        }

        .orpha-chat-close:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .orpha-chat-frame-wrap {
          position: relative;
          height: calc(100% - 52px);
          background: #FAFAF8;
        }

        .orpha-chat-brand-cover {
          position: absolute;
          top: 0;
          left: 50%;
          width: 112px;
          height: 38px;
          transform: translateX(-50%);
          background: #078BFF;
          z-index: 2;
          pointer-events: none;
        }

        .orpha-chat-button {
          margin-left: auto;
          width: 62px;
          height: 62px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: #0F6E56;
          box-shadow: 0 16px 38px rgba(15, 110, 86, 0.34);
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .orpha-chat-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 44px rgba(15, 110, 86, 0.4);
          background: #0B5C49;
        }

        .orpha-chat-button.is-open {
          background: #042C53;
        }

        @media (max-width: 640px) {
          .orpha-chat-widget {
            right: 14px;
            bottom: 14px;
          }

          .orpha-chat-panel {
            position: fixed;
            right: 10px;
            left: 10px;
            bottom: 84px;
            width: auto;
            height: min(640px, calc(100vh - 104px));
            border-radius: 14px;
          }

          .orpha-chat-button {
            width: 58px;
            height: 58px;
          }
        }
      `}</style>
      <div className="orpha-chat-widget" aria-live="polite">
        <section className={`orpha-chat-panel${isOpen ? " is-open" : ""}`} aria-label="OrphaAI Assistant">
          <div className="orpha-chat-header">
            <div className="orpha-chat-title">
              <span className="orpha-chat-status" />
              <span>OrphaAI Assistant</span>
            </div>
            <button className="orpha-chat-close" type="button" onClick={onClose} aria-label="Close OrphaAI Assistant">
              x
            </button>
          </div>
          <div className="orpha-chat-frame-wrap">
            <div className="orpha-chat-brand-cover" aria-hidden="true" />
            <iframe
              src={TARS_AGENT_URL}
              title="OrphaAI Tars Assistant"
              width="100%"
              height="100%"
              style={{
                border: "none",
                borderRadius: "0 0 16px 16px",
              }}
            />
          </div>
        </section>

        <button
          className={`orpha-chat-button${isOpen ? " is-open" : ""}`}
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Close OrphaAI Assistant" : "Open OrphaAI Assistant"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 6.8A4.8 4.8 0 0 1 9.8 2h4.4A4.8 4.8 0 0 1 19 6.8v4.4a4.8 4.8 0 0 1-4.8 4.8H12l-4.8 3.5V16A4.8 4.8 0 0 1 5 11.2V6.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 9h.01M12 9h.01M15 9h.01" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
