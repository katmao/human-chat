"use client";
import { useEffect, useState } from "react";
import { 
  Box, 
  Button, 
  Text, 
  VStack, 
  HStack, 
  Badge, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  Input,
  Select,
  Flex,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@chakra-ui/react";

interface LogEntry {
  id: string;
  sessionId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  messageCount: number;
  participant1MessageCount: number;
  participant2MessageCount: number;
  systemMessageCount: number;
  messages: Array<{
    sender: 'Participant 1' | 'Participant 2' | 'system';
    content: string;
    timestamp: string;
  }>;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/export-logs?limit=50');
      const data = await response.json();
      
      if (data.data) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch logs",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/export-logs?format=${format}&limit=1000`);
      
      if (format === 'csv') {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `human-interactions-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Download JSON file
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `human-interactions-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      toast({
        title: "Success",
        description: `Exported ${format.toUpperCase()} file`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "Error",
        description: "Failed to export logs",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const viewLogDetails = (log: LogEntry) => {
    setSelectedLog(log);
    onOpen();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box p={8}>
        <Text>Loading logs...</Text>
      </Box>
    );
  }

  return (
    <Box p={8}>
      <VStack align="stretch" spacing={6}>
        <Flex justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold">Human Interaction Logs</Text>
          <HStack spacing={4}>
            <Button colorScheme="blue" onClick={() => exportLogs('json')}>
              Export JSON
            </Button>
            <Button colorScheme="green" onClick={() => exportLogs('csv')}>
              Export CSV
            </Button>
            <Button onClick={fetchLogs}>
              Refresh
            </Button>
          </HStack>
        </Flex>

        <Box>
          <Text fontSize="lg" mb={4}>
            Total Logs: {logs.length}
          </Text>
        </Box>

        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Session ID</Th>
                <Th>Start Time</Th>
                <Th>Duration</Th>
                <Th>Messages</Th>
                <Th>P1/P2/Sys</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {logs.map((log) => (
                <Tr key={log.id}>
                  <Td>
                    <Text fontSize="sm" fontFamily="mono">
                      {log.sessionId.slice(0, 8)}...
                    </Text>
                  </Td>
                  <Td>{formatDate(log.startTime)}</Td>
                  <Td>{formatDuration(log.duration)}</Td>
                  <Td>
                    <Badge colorScheme="blue">{log.messageCount}</Badge>
                  </Td>
                  <Td>
                    <HStack spacing={1}>
                      <Badge colorScheme="green">{log.participant1MessageCount}</Badge>
                      <Badge colorScheme="purple">{log.participant2MessageCount}</Badge>
                      <Badge colorScheme="gray">{log.systemMessageCount}</Badge>
                    </HStack>
                  </Td>
                  <Td>
                    <Button size="sm" onClick={() => viewLogDetails(log)}>
                      View Details
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>

      {/* Log Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Log Details</ModalHeader>
          <ModalBody>
            {selectedLog && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="bold">Session ID:</Text>
                  <Text fontFamily="mono">{selectedLog.sessionId}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Duration:</Text>
                  <Text>{formatDuration(selectedLog.duration)}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Message Counts:</Text>
                  <HStack spacing={2}>
                    <Badge colorScheme="green">P1: {selectedLog.participant1MessageCount}</Badge>
                    <Badge colorScheme="purple">P2: {selectedLog.participant2MessageCount}</Badge>
                    <Badge colorScheme="gray">Sys: {selectedLog.systemMessageCount}</Badge>
                  </HStack>
                </Box>
                <Box>
                  <Text fontWeight="bold">Messages:</Text>
                  <Box maxH="400px" overflowY="auto" border="1px" borderColor="gray.200" p={4} borderRadius="md">
                    {selectedLog.messages.map((msg, idx) => (
                      <Box key={idx} mb={2} p={2} bg={msg.sender === 'system' ? 'gray.50' : 'white'} borderRadius="md">
                        <Text fontSize="sm" color="gray.600">
                          {msg.sender} - {formatDate(msg.timestamp)}
                        </Text>
                        <Text>{msg.content}</Text>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
} 