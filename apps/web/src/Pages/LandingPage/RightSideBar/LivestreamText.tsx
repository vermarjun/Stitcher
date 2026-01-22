import { useEffect, useState, useRef } from "react";

interface LiveTextStreamProps {
  text: string;
  streamingSpeed?: number;
  onStreamingComplete?: () => void;
}

const LiveTextStream = ({ 
  text, 
  streamingSpeed = 50,
  onStreamingComplete 
}: LiveTextStreamProps) => {
  const [displayedText, setDisplayedText] = useState<string[]>([]);
  const [, setIsStreaming] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

  const words = text.split(' ');

  useEffect(() => {
    if (!text) return;

    setIsStreaming(true);
    setDisplayedText([]);

    let currentIndex = 0;

    const streamInterval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(prev => [...prev, words[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
        onStreamingComplete?.();
      }
    }, streamingSpeed);

    return () => {
      clearInterval(streamInterval);
    };
  }, [text, streamingSpeed, onStreamingComplete]);

  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [displayedText]);

  return (
    <div 
      ref={textContainerRef}
      className="bg-transparent text-sm text-neutral-300 leading-relaxed overflow-y-auto"
    >
      {displayedText.map((word, index) => (
        <span key={index} className="inline">
          {word}{' '}
        </span>
      ))}
    </div>
  );
};

export default LiveTextStream;
