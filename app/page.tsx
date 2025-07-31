'use client';
/*eslint-disable*/

import Link from '@/components/link/Link';
import MessageBoxChat from '@/components/MessageBox';
import { ChatBody, OpenAIModel } from '@/types/types';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Flex,
  Icon,
  Img,
  Input,
  Text,
  useColorModeValue,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react';
import { useEffect, useState, useRef } from 'react';
import { MdAutoAwesome, MdBolt, MdEdit, MdPerson } from 'react-icons/md';
import Bg from '../public/img/chat/bg-image.png';
import { db } from '../src/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, updateDoc, getDocs, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { createInteractionLog, addMessageToLog, finalizeInteractionLog } from '../src/utils/logging';

interface Message {
  sender: 'Participant 1' | 'Participant 2' | 'system';
  content: string;
}

export default function Chat() {
  // Input States
  const [inputOnSubmit, setInputOnSubmit] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  // Message history
  const [messages, setMessages] = useState<Message[]>([]);
  // Current user
  const [currentUser, setCurrentUser] = useState<'Participant 1' | 'Participant 2' | null>(null);
  // Reference to the messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);

  // Scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser) {
      onOpen();
    }
  }, [currentUser, onOpen]);

  useEffect(() => {
    if (!sessionId) return;
    // Subscribe to Firestore messages for this session
    const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({ sender: data.sender, content: data.content });
      });
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [sessionId]);

  // When user selects a user, generate a new sessionId and create session doc
  const handleUserSelect = async (user: 'Participant 1' | 'Participant 2') => {
    const newSessionId = uuidv4();
    setCurrentUser(user);
    setSessionId(newSessionId);
    
    // Create interaction log
    try {
      const newLogId = await createInteractionLog(newSessionId);
      setLogId(newLogId);
      console.log('Created interaction log:', newLogId);
    } catch (error) {
      console.error('Error creating interaction log:', error);
    }
    
    // Set Participant 1 presence to online first
    await setDoc(doc(db, `sessions/${newSessionId}/presence/participant1`), { online: true });
    // Then create session doc with archived: false
    await setDoc(doc(db, 'sessions', newSessionId), { archived: false }, { merge: true });
    // Add system message for join
    const joinMessage = {
      sender: 'system' as const,
      content: `${user} has joined`,
      timestamp: new Date(),
    };
    await addDoc(collection(db, `sessions/${newSessionId}/messages`), joinMessage);
    
    // Log the join message
    if (logId) {
      try {
        await addMessageToLog(logId, joinMessage);
      } catch (error) {
        console.error('Error logging join message:', error);
      }
    }
  };

  // Presence: set online on join, offline on unload
  useEffect(() => {
    if (!sessionId || currentUser !== 'Participant 1') return;
    
    const presenceRef = doc(db, `sessions/${sessionId}/presence/participant1`);
    
    const setOnline = async () => {
      try {
        await setDoc(presenceRef, { 
          online: true, 
          lastSeen: new Date(),
          heartbeat: Date.now()
        }, { merge: true });
        console.log('Participant 1: Set online');
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
        console.log('Participant 1: Set offline');
        // Add system message for leave
        const leaveMessage = {
          sender: 'system' as const,
          content: `Participant 1 has left`,
          timestamp: new Date(),
        };
        await addDoc(collection(db, `sessions/${sessionId}/messages`), leaveMessage);
        
        // Log the leave message
        if (logId) {
          try {
            await addMessageToLog(logId, leaveMessage);
          } catch (error) {
            console.error('Error logging leave message:', error);
          }
        }
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
        console.log('Participant 1: Heartbeat update');
      } catch (error) {
        console.error('Error in heartbeat:', error);
      }
    }, 30000);
    
    // Handle page unload
    const handleBeforeUnload = () => {
      console.log('Participant 1: Page unloading, setting offline');
      setOffline();
      // Finalize the interaction log
      if (logId) {
        finalizeInteractionLog(logId);
      }
    };
    
    // Handle visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Participant 1: Page hidden');
      } else {
        console.log('Participant 1: Page visible again');
        setOnline();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('Participant 1: Cleaning up presence');
      clearInterval(heartbeatInterval);
      setOffline();
      // Finalize the interaction log
      if (logId) {
        finalizeInteractionLog(logId);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, currentUser, logId]);

  // Listen for Participant 2 presence and add join message if needed
  useEffect(() => {
    if (!sessionId || currentUser !== 'Participant 1') return;
    const presenceRef = doc(db, `sessions/${sessionId}/presence/participant2`);
    const unsubscribe = onDocSnapshot(presenceRef, async (docSnap) => {
      const data = docSnap.data();
      if (data?.online) {
        // Check if join message already exists
        const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy('timestamp'));
        const snapshot = await getDocs(q);
        const alreadyJoined = snapshot.docs.some(doc => doc.data().content === 'Participant 2 has joined');
        if (!alreadyJoined) {
          const joinMessage = {
            sender: 'system' as const,
            content: 'Participant 2 has joined',
            timestamp: new Date(),
          };
          await addDoc(collection(db, `sessions/${sessionId}/messages`), joinMessage);
          
          // Log the join message
          if (logId) {
            try {
              await addMessageToLog(logId, joinMessage);
            } catch (error) {
              console.error('Error logging Participant 2 join message:', error);
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, [sessionId, currentUser, logId]);

  const handleSend = async () => {
    if (!inputCode.trim() || !sessionId || !currentUser) return;
    
    const message = {
      sender: currentUser,
      content: inputCode,
      timestamp: new Date(),
    };
    
    await addDoc(collection(db, `sessions/${sessionId}/messages`), message);
    
    // Log the message
    if (logId) {
      try {
        await addMessageToLog(logId, message);
      } catch (error) {
        console.error('Error logging message:', error);
      }
    }
    
    setInputCode('');
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <Box minH="100vh" bg="#FCFDFD" display="flex" flexDirection="column" justifyContent="flex-start" alignItems="center">
      {/* User selection modal */}
      <Modal isOpen={!currentUser} onClose={() => {}} isCentered closeOnOverlayClick={false} closeOnEsc={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalBody>
            <Flex direction="column" gap={4} alignItems="center">
              <Button colorScheme="blue" w="100%" onClick={() => handleUserSelect('Participant 1')}>Join as Participant 1</Button>
            </Flex>
          </ModalBody>
          <ModalFooter />
        </ModalContent>
      </Modal>
      <Box
        w={{ base: '100%', sm: '90%', md: '600px' }}
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
              justifyContent={msg.sender === 'Participant 1' ? 'flex-end' : 'flex-start'}
              mb={2}
            >
              <Box
                bg={msg.sender === 'Participant 1' ? '#9CA3AF' : '#E5E7EB'}
                color="#222"
                px={4}
                py={3}
                borderRadius="8px"
                maxW="80%"
                fontSize="md"
                style={{ boxShadow: 'none' }}
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
        <Box w={{ base: '100%', sm: '90%', md: '600px' }}>
          <Flex as="form" onSubmit={e => { e.preventDefault(); handleSend(); }}>
            <Input
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={currentUser ? `Type your message...` : ''}
              bg="#F3F4F6"
              borderRadius="8px"
              border="1px solid #E5E7EB"
              fontSize="md"
              color="#222"
              _placeholder={{ color: '#A0AEC0' }}
              mr={2}
              autoFocus
              _focus={{ boxShadow: 'none', borderColor: '#E5E7EB' }}
              disabled={!currentUser}
            />
            <Button
              type="submit"
              colorScheme="gray"
              borderRadius="8px"
              px={6}
              bg="#E5E7EB"
              color="#222"
              _hover={{ bg: '#D1D5DB' }}
              boxShadow="none"
              disabled={!currentUser}
            >
              Send
            </Button>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
