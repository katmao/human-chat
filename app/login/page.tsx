'use client';

import { FormEvent, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
} from '@chakra-ui/react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await user.getIdToken();
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        await signOut(auth);
        const { error: responseError } = await response.json();
        throw new Error(responseError ?? 'Failed to start session');
      }

      router.push(redirectPath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to sign in. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="#F8F9FC" px={4}>
      <Box
        as="form"
        onSubmit={handleSubmit}
        bg="white"
        p={8}
        borderRadius="lg"
        boxShadow="lg"
        width="100%"
        maxW="400px"
      >
        <Heading size="lg" mb={6} textAlign="center">
          Admin Login
        </Heading>

        {error && (
          <Alert status="error" mb={4}>
            <AlertIcon />
            {error}
          </Alert>
        )}

        <FormControl mb={4} isRequired>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="assistant@example.com"
          />
        </FormControl>

        <FormControl mb={6} isRequired>
          <FormLabel>Password</FormLabel>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </FormControl>

        <Button
          type="submit"
          colorScheme="blue"
          width="100%"
          isLoading={isSubmitting}
        >
          Sign In
        </Button>

        <Text fontSize="sm" color="gray.500" mt={4} textAlign="center">
          Use the email account provisioned in Firebase Authentication.
        </Text>
      </Box>
    </Flex>
  );
}
