"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";

type ChatSocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
};

const ChatSocketContext = createContext<ChatSocketContextValue>({
  socket: null,
  isConnected: false,
  joinConversation: () => {},
  leaveConversation: () => {},
});

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const auth = useCustomerAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!auth.enabled) {
      return;
    }

    // Connect to API server via environment variable
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || window.location.origin.replace(':3000', ':4000');
    
    const newSocket = io(`${apiOrigin}/chat`, {
      auth: {
        ...(auth.authHeaders.bearerToken ? { clerkToken: auth.authHeaders.bearerToken } : {}),
        ...(auth.authHeaders.platformUserId ? { platformUserId: auth.authHeaders.platformUserId } : {}),
        ...(auth.authHeaders.clerkUserId && !auth.authHeaders.bearerToken ? { clerkUserId: auth.authHeaders.clerkUserId } : {}),
      },
      withCredentials: true,
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [auth.authHeaders.bearerToken, auth.authHeaders.clerkUserId, auth.authHeaders.platformUserId, auth.authKey, auth.enabled]);

  const joinConversation = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit("join", { conversationId });
    }
  };

  const leaveConversation = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit("leave", { conversationId });
    }
  };

  return (
    <ChatSocketContext.Provider value={{ socket, isConnected, joinConversation, leaveConversation }}>
      {children}
    </ChatSocketContext.Provider>
  );
}

export function useChatSocket() {
  const context = useContext(ChatSocketContext);
  if (!context) {
    throw new Error("useChatSocket must be used within ChatSocketProvider");
  }
  return context;
}
