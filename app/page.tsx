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
} from '@chakra-ui/react';
import { useEffect, useState, useRef } from 'react';
import { MdAutoAwesome, MdBolt, MdEdit, MdPerson } from 'react-icons/md';
import Bg from '../public/img/chat/bg-image.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isTyping?: boolean;
}

export default function Chat() {
  // Input States
  const [inputOnSubmit, setInputOnSubmit] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  // Message history
  const [messages, setMessages] = useState<Message[]>([]);
  // Response message
  const [outputCode, setOutputCode] = useState<string>('');
  // ChatGPT model
  const [model, setModel] = useState<OpenAIModel>('gpt-4o');
  // Loading state
  const [loading, setLoading] = useState<boolean>(false);
  // Reference to the messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, outputCode]);

  // API Key
  // const [apiKey, setApiKey] = useState<string>(apiKeyApp);
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const inputColor = useColorModeValue('navy.700', 'white');
  const iconColor = useColorModeValue('brand.500', 'white');
  const bgIcon = useColorModeValue(
    'linear-gradient(180deg, #FBFBFF 0%, #CACAFF 100%)',
    'whiteAlpha.200',
  );
  const brandColor = useColorModeValue('brand.500', 'white');
  const buttonBg = useColorModeValue('white', 'whiteAlpha.100');
  const gray = useColorModeValue('gray.500', 'white');
  const buttonShadow = useColorModeValue(
    '14px 27px 45px rgba(112, 144, 176, 0.2)',
    'none',
  );
  const textColor = useColorModeValue('navy.700', 'white');
  const placeholderColor = useColorModeValue(
    { color: 'gray.500' },
    { color: 'whiteAlpha.600' },
  );
  const handleTranslate = async () => {
    // Chat post conditions(maximum number of characters, valid message etc.)
    const maxCodeLength = model === 'gpt-4o' ? 700 : 700;

    if (!inputCode) {
      alert('Please enter your message.');
      return;
    }

    if (inputCode.length > maxCodeLength) {
      alert(
        `Please enter code less than ${maxCodeLength} characters. You are currently at ${inputCode.length} characters.`,
      );
      return;
    }

    // Add user message to history
    setMessages(prev => [...prev, { role: 'user', content: inputCode }]);
    
    setLoading(true);
    const controller = new AbortController();
    const body: ChatBody = {
      inputCode,
      model
    };

    // -------------- Fetch --------------
    const response = await fetch('./api/chatAPI', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      setLoading(false);
      alert('Something went wrong with the API request. Please check the server configuration.');
      return;
    }

    const data = response.body;

    if (!data) {
      setLoading(false);
      alert('Something went wrong');
      return;
    }

    // Add assistant message placeholder without typing indicator
    setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = '';

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunkValue = decoder.decode(value);
        // Add a small delay between chunks to slow down the typing effect
        await delay(50);
        
        accumulatedResponse += chunkValue;
        
        // Update the last message with the accumulated response
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedResponse;
            }
          }
          return newMessages;
        });
      }
    } finally {
      // Ensure typing indicator is removed when done
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0) {
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.isTyping = false;
          }
        }
        return newMessages;
      });
      setLoading(false);
      setInputCode('');
    }
  };
  // -------------- Copy Response --------------
  // const copyToClipboard = (text: string) => {
  //   const el = document.createElement('textarea');
  //   el.value = text;
  //   document.body.appendChild(el);
  //   el.select();
  //   document.execCommand('copy');
  //   document.body.removeChild(el);
  // };

  // *** Initializing apiKey with .env.local value
  // useEffect(() => {
  // ENV file verison
  // const apiKeyENV = process.env.NEXT_PUBLIC_OPENAI_API_KEY
  // if (apiKey === undefined || null) {
  //   setApiKey(apiKeyENV)
  // }
  // }, [])

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleTranslate();
    }
  };

  const handleChange = (Event: any) => {
    setInputCode(Event.target.value);
  };

  return (
    <Box minH="100vh" bg="#FCFDFD" display="flex" flexDirection="column" justifyContent="flex-start" alignItems="center">
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
          <Box
            key={idx}
            display="flex"
            justifyContent="flex-start"
            mb={2}
          >
            <Box
              bg={msg.role === 'assistant' ? '#9CA3AF' : '#E5E7EB'}
              color="#222"
              px={4}
              py={3}
              borderRadius="8px"
              maxW="80%"
              fontSize="md"
              style={{ boxShadow: 'none' }}
            >
              {msg.content}
              {msg.isTyping && <span className="typing-indicator">|</span>}
            </Box>
          </Box>
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
          <Flex as="form" onSubmit={e => { e.preventDefault(); handleTranslate(); }}>
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
              _placeholder={{ color: '#A0AEC0' }}
              mr={2}
              autoFocus
              _focus={{ boxShadow: 'none', borderColor: '#E5E7EB' }}
            />
            <Button
              type="submit"
              colorScheme="gray"
              borderRadius="8px"
              px={6}
              isLoading={loading}
              disabled={loading}
              bg="#E5E7EB"
              color="#222"
              _hover={{ bg: '#D1D5DB' }}
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
