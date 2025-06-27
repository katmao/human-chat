"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { Box, Button, Flex, Input, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@chakra-ui/react";
import { db } from "../../src/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, getDocs, onSnapshot as onDocSnapshot } from "firebase/firestore";
import { useSearchParams } from 'next/navigation';

interface Message {
  sender: "Participant 1" | "Participant 2" | "system";
  content: string;
}

function ConfederateChatContent() {
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string>("");
  const [inputSessionId, setInputSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputCode, setInputCode] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [joined, setJoined] = useState(false);

  // Auto-join if sessionId is in the URL
  useEffect(() => {
    const urlSessionId = searchParams.get('sessionId');
    if (urlSessionId && !joined) {
      setSessionId(urlSessionId);
      setJoined(true);
    }
  }, [searchParams, joined]);

  useEffect(() => {
    if (!joined || !sessionId) return;
    const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({ sender: data.sender, content: data.content });
      });
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [joined, sessionId]);

  // Presence tracking for Participant 2
  useEffect(() => {
    if (!sessionId || !joined) return;
    
    const presenceRef = doc(db, `sessions/${sessionId}/presence/participant2`);
    
    const setOnline = async () => {
      try {
        await setDoc(presenceRef, { 
          online: true, 
          lastSeen: new Date(),
          heartbeat: Date.now()
        }, { merge: true });
        console.log('Participant 2: Set online');
      } catch (error) {
        console.error('Error setting online:', error);
      }
    };
    
    const setOffline = async () => {
      try {
        await setDoc(presenceRef, { 
          online: false, 
          lastSeen: new Date(),
          heartbeat: Date.now()
        }, { merge: true });
        console.log('Participant 2: Set offline');
        // Add system message for leave
        await addDoc(collection(db, `sessions/${sessionId}/messages`), {
          sender: 'system',
          content: `Participant 2 has left`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error setting offline:', error);
      }
    };
    
    // Set online immediately
    setOnline();
    
    // Heartbeat: update presence every 30 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        await setDoc(presenceRef, { 
          online: true, 
          lastSeen: new Date(),
          heartbeat: Date.now()
        }, { merge: true });
        console.log('Participant 2: Heartbeat update');
      } catch (error) {
        console.error('Error in heartbeat:', error);
      }
    }, 30000);
    
    // Handle page unload
    const handleBeforeUnload = () => {
      console.log('Participant 2: Page unloading, setting offline');
      setOffline();
    };
    
    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Participant 2: Page hidden');
      } else {
        console.log('Participant 2: Page visible again');
        setOnline();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('Participant 2: Cleaning up presence');
      clearInterval(heartbeatInterval);
      setOffline();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, joined]);

  // Listen for Participant 1 presence and add leave message if needed
  useEffect(() => {
    if (!sessionId || !joined) return;
    const presenceRef = doc(db, `sessions/${sessionId}/presence/participant1`);
    const unsubscribe = onDocSnapshot(presenceRef, async (docSnap) => {
      const data = docSnap.data();
      if (data && data.online === false) {
        // Check if leave message already exists
        const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy('timestamp'));
        const snapshot = await getDocs(q);
        const alreadyLeft = snapshot.docs.some(doc => doc.data().content === 'Participant 1 has left');
        if (!alreadyLeft) {
          await addDoc(collection(db, `sessions/${sessionId}/messages`), {
            sender: 'system',
            content: 'Participant 1 has left',
            timestamp: new Date(),
          });
        }
      }
    });
    return () => unsubscribe();
  }, [sessionId, joined]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputCode.trim() || !sessionId) return;
    await addDoc(collection(db, `sessions/${sessionId}/messages`), {
      sender: "Participant 2",
      content: inputCode,
      timestamp: new Date(),
    });
    setInputCode("");
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  if (!joined) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="#FCFDFD">
        <Box bg="white" p={8} borderRadius="md" boxShadow="md" minW="320px">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (inputSessionId.trim()) {
                setSessionId(inputSessionId.trim());
                setJoined(true);
              }
            }}
          >
            <Input
              placeholder="Enter session ID"
              value={inputSessionId}
              onChange={e => setInputSessionId(e.target.value)}
              mb={4}
            />
            <Button type="submit" colorScheme="blue" w="100%">Join as Participant 2</Button>
          </form>
        </Box>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="#FCFDFD" display="flex" flexDirection="column" justifyContent="flex-start" alignItems="center">
      <Box
        w={{ base: "100%", sm: "90%", md: "600px" }}
        maxW="100%"
        flex="1"
        display="flex"
        flexDirection="column"
        pt={12}
        pb={24}
      >
        {messages.map((msg, idx) => (
          msg.sender === 'system' ? (
            <Box key={idx} display="flex" justifyContent="center" mb={2}>
              <Box bg="#F3F4F6" color="#666" px={4} py={2} borderRadius="8px" fontSize="sm" fontStyle="italic">
                {msg.content}
              </Box>
            </Box>
          ) : (
            <Box
              key={idx}
              display="flex"
              justifyContent={msg.sender === "Participant 1" ? "flex-start" : "flex-end"}
              mb={2}
            >
              <Box
                bg={msg.sender === "Participant 1" ? "#E5E7EB" : "#9CA3AF"}
                color="#222"
                px={4}
                py={3}
                borderRadius="8px"
                maxW="80%"
                fontSize="md"
                style={{ boxShadow: "none" }}
              >
                {msg.content}
              </Box>
            </Box>
          )
        ))}
        <div ref={messagesEndRef} />
      </Box>
      <Box
        position="fixed"
        bottom={0}
        left={0}
        w="100%"
        bg="#FCFDFD"
        borderTop="1px solid #E5E7EB"
        py={3}
        px={{ base: 2, sm: 0 }}
        display="flex"
        justifyContent="center"
        zIndex={10}
      >
        <Box w={{ base: "100%", sm: "90%", md: "600px" }}>
          <Flex as="form" onSubmit={e => { e.preventDefault(); handleSend(); }}>
            <Input
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              bg="#F3F4F6"
              borderRadius="8px"
              border="1px solid #E5E7EB"
              fontSize="md"
              color="#222"
              _placeholder={{ color: "#A0AEC0" }}
              mr={2}
              autoFocus
              _focus={{ boxShadow: "none", borderColor: "#E5E7EB" }}
            />
            <Button
              type="submit"
              colorScheme="gray"
              borderRadius="8px"
              px={6}
              bg="#E5E7EB"
              color="#222"
              _hover={{ bg: "#D1D5DB" }}
              boxShadow="none"
            >
              Send
            </Button>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}

export default function ConfederateChat() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfederateChatContent />
    </Suspense>
  );
} 