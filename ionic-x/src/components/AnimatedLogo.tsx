import {useEffect} from "react";

interface AnimatedLogoProps {
    onAnimationComplete: () => void;
}
function AnimatedLogo({ onAnimationComplete }: AnimatedLogoProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onAnimationComplete();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onAnimationComplete]);

  return (
      <div className="relative w-screen min-h-screen flex flex-col items-center justify-center gap-4">
          <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-20 left-10 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />
              <div className="absolute top-24 right-10 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
              <div className="absolute bottom-16 left-1/3 h-40 w-40 rounded-full bg-rose-200/30 blur-3xl" />
          </div>
          <svg className="relative block mx-auto" width="250" height="100" viewBox="0 0 250 100">
              <style>
                  {`
            @keyframes moveCross {
              0%, 10% { transform: translateX(-70px); }
              90%, 100% { transform: translateX(0); }
            }
            @keyframes transformCrossToX {
              0%, 10% { d: path('M220 25 V75 M210 35 H230'); }
              20%, 30% { d: path('M220 25 L220 75 M210 45 L230 30'); }
              50% { d: path('M220 25 L220 75 M210 50 L230 70'); }
              70% { d: path('M215 30 L225 70 M210 55 L230 75'); }
              90%, 100% { d: path('M210 25 L230 75 M210 75 L230 25'); }
            }
            @keyframes fadeInLetters {
              0% { opacity: 0; }
              100% { opacity: 1; }
            }
            @keyframes slideInLetters {
              0% { transform: translateX(10rem); }
              100% { transform: translateX(5rem); }
            }
            .x {
              animation: 
                moveCross 3s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards,
                transformCrossToX 3s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
            }
            .letters {
              opacity: 0;
              animation: 
                fadeInLetters 1s ease-out 1s forwards,
                slideInLetters 1s cubic-bezier(0.25, 0.1, 0.25, 1) 1s forwards;
            }
          `}
              </style>
              <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--brand-from)" />
                      <stop offset="100%" stopColor="var(--brand-to)" />
                  </linearGradient>
              </defs>
              <g>
                  <path className="x" d="M220 25 V75 M210 35 H230" strokeWidth="5" stroke="#7f7e80" fill="none" strokeLinecap="round"/>
                  <g className="letters" fill="url(#gradient)" style={{ fontSize: "54px", fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 700 }}>
                      <text x="5" y="70">ionic</text>
                  </g>
              </g>
          </svg>
      </div>
  );
}

export default AnimatedLogo;
