"use client";
import { useEffect, useState } from "react";
import { Box, Button, Flex, Text, Badge, VStack, HStack } from "@chakra-ui/react";
import { db } from "../../src/firebase";
import { collection, doc, getDoc, onSnapshot, updateDoc, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface Session {
  id: string;
  archived: boolean;
  presence: {
    participant1?: { online: boolean };
    participant2?: { online: boolean };
  };
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      // Listen for all sessions where archived: false
      const q = query(collection(db, "sessions"), where("archived", "==", false));
      const unsub = onSnapshot(q, async (snapshot) => {
        try {
          const sessionList: Session[] = [];
          for (const docSnap of snapshot.docs) {
            const sessionId = docSnap.id;
            const data = docSnap.data();
            
            // Get presence info
            const user1Snap = await getDoc(doc(db, `sessions/${sessionId}/presence/participant1`));
            const user2Snap = await getDoc(doc(db, `sessions/${sessionId}/presence/participant2`));
            
            const user1Data = user1Snap.exists() ? user1Snap.data() as { online: boolean; lastSeen?: any; heartbeat?: number } : null;
            const user2Data = user2Snap.exists() ? user2Snap.data() as { online: boolean; lastSeen?: any; heartbeat?: number } : null;
            
            // Check if heartbeats are stale (more than 2 minutes old)
            const now = Date.now();
            const user1Online = user1Data?.online && user1Data?.heartbeat && (now - user1Data.heartbeat) < 120000;
            const user2Online = user2Data?.online && user2Data?.heartbeat && (now - user2Data.heartbeat) < 120000;
            
            console.log(`Session ${sessionId}: Participant1 online=${user1Online}, Participant2 online=${user2Online}`);
            
            // Archive session if both participants are offline or have stale heartbeats
            if (!user1Online && !user2Online) {
              try {
                console.log(`Archiving session ${sessionId} - both participants offline`);
                await updateDoc(doc(db, 'sessions', sessionId), { archived: true });
              } catch (error) {
                console.error('Error archiving session:', error);
              }
              continue; // Don't show archived sessions
            }
            
            sessionList.push({
              id: sessionId,
              archived: data.archived,
              presence: {
                participant1: user1Data ? { online: Boolean(user1Online) } : undefined,
                participant2: user2Data ? { online: Boolean(user2Online) } : undefined,
              },
            });
          }
          setSessions(sessionList);
          setLoading(false);
        } catch (error) {
          console.error('Error processing sessions:', error);
          setLoading(false);
        }
      });
      return () => unsub();
    } catch (error) {
      console.error('Error setting up admin page:', error);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <Box p={8}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box p={8}>
      <Text fontSize="2xl" mb={6}>Waiting Room / Admin</Text>
      <VStack align="stretch" spacing={4}>
        {sessions.length === 0 && <Text>No active sessions.</Text>}
        {sessions.map(session => (
          <Box key={session.id} p={4} borderWidth={1} borderRadius="md" bg="white">
            <HStack justify="space-between">
              <Box>
                <Text fontWeight="bold">Session ID: {session.id}</Text>
                <HStack mt={2}>
                  <Badge colorScheme={session.presence.participant1?.online ? "green" : "red"}>Participant 1: {session.presence.participant1?.online ? "Online" : "Offline"}</Badge>
                  <Badge colorScheme={session.presence.participant2?.online ? "green" : "red"}>Participant 2: {session.presence.participant2?.online ? "Online" : "Offline"}</Badge>
                </HStack>
              </Box>
              <Button colorScheme="blue" onClick={() => router.push(`/confederate?sessionId=${session.id}`)}>
                Join as Participant 2
              </Button>
            </HStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
} 