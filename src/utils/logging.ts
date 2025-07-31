import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

export interface HumanInteractionLog {
  sessionId: string;
  participant1: string;
  participant2: string;
  startTime: Date;
  endTime?: Date;
  messages: {
    sender: 'Participant 1' | 'Participant 2' | 'system';
    content: string;
    timestamp: Date;
  }[];
  duration?: number; // in seconds
  messageCount: number;
  participant1MessageCount: number;
  participant2MessageCount: number;
  systemMessageCount: number;
  metadata?: {
    userAgent?: string;
    platform?: string;
    screenResolution?: string;
  };
}

export const createInteractionLog = async (sessionId: string): Promise<string> => {
  try {
    const logData: Partial<HumanInteractionLog> = {
      sessionId,
      participant1: 'Unknown',
      participant2: 'Unknown',
      startTime: new Date(),
      messages: [],
      messageCount: 0,
      participant1MessageCount: 0,
      participant2MessageCount: 0,
      systemMessageCount: 0,
      metadata: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        platform: typeof window !== 'undefined' ? window.navigator.platform : undefined,
        screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined,
      }
    };

    const docRef = await addDoc(collection(db, 'human_interactions'), logData);
    console.log('Created interaction log:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating interaction log:', error);
    throw error;
  }
};

export const updateInteractionLog = async (
  logId: string, 
  updates: Partial<HumanInteractionLog>
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'human_interactions', logId), updates);
    console.log('Updated interaction log:', logId);
  } catch (error) {
    console.error('Error updating interaction log:', error);
    throw error;
  }
};

export const addMessageToLog = async (
  logId: string,
  message: {
    sender: 'Participant 1' | 'Participant 2' | 'system';
    content: string;
    timestamp: Date;
  }
): Promise<void> => {
  try {
    // Get current log data
    const logDoc = await getDoc(doc(db, 'human_interactions', logId));
    if (!logDoc.exists()) {
      throw new Error('Interaction log not found');
    }

    const currentData = logDoc.data() as HumanInteractionLog;
    const updatedMessages = [...currentData.messages, message];
    
    // Count messages by sender
    const participant1Count = updatedMessages.filter(m => m.sender === 'Participant 1').length;
    const participant2Count = updatedMessages.filter(m => m.sender === 'Participant 2').length;
    const systemCount = updatedMessages.filter(m => m.sender === 'system').length;

    await updateDoc(doc(db, 'human_interactions', logId), {
      messages: updatedMessages,
      messageCount: updatedMessages.length,
      participant1MessageCount: participant1Count,
      participant2MessageCount: participant2Count,
      systemMessageCount: systemCount,
    });
  } catch (error) {
    console.error('Error adding message to log:', error);
    throw error;
  }
};

export const finalizeInteractionLog = async (
  logId: string,
  endTime: Date = new Date()
): Promise<void> => {
  try {
    const logDoc = await getDoc(doc(db, 'human_interactions', logId));
    if (!logDoc.exists()) {
      throw new Error('Interaction log not found');
    }

    const currentData = logDoc.data() as HumanInteractionLog;
    const duration = Math.floor((endTime.getTime() - currentData.startTime.getTime()) / 1000);

    await updateDoc(doc(db, 'human_interactions', logId), {
      endTime,
      duration,
    });

    console.log('Finalized interaction log:', logId, 'Duration:', duration, 'seconds');
  } catch (error) {
    console.error('Error finalizing interaction log:', error);
    throw error;
  }
}; 