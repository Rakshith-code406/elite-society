import { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, getDoc, limit, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ChatRoom, ChatMessage, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Send, MessageCircle, Trash2, Loader2, ChevronLeft } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import Avatar from '../components/Avatar';
import { usePresence } from '../context/PresenceContext';
import { getPresenceTone } from '../lib/presence';

export default function MessagesView({ currentUser, initialTargetUserId }: { currentUser: UserProfile, initialTargetUserId?: string | null }) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgLimit, setMsgLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const initializationPerformed = useRef(false);
  const { getPresence, getPresenceText } = usePresence();

  useEffect(() => {
    const q = query(
      collection(db, 'rooms'),
      where('participants', 'array-contains', currentUser.userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const roomList: ChatRoom[] = [];
      for (const d of snap.docs) {
        const data = d.data() as ChatRoom;
        const otherUserId = data.participants.find(p => p !== currentUser.userId);
        if (otherUserId) {
          const userSnap = await getDoc(doc(db, 'users', otherUserId));
          const otherUser = userSnap.exists() ? userSnap.data() as UserProfile : undefined;
          roomList.push({ id: d.id, ...data, otherUser });
        }
      }
      setRooms(roomList);
      setLoading(false);

      // Handle initial target user
      if (initialTargetUserId && !initializationPerformed.current) {
        initializationPerformed.current = true;
        
        // Find existing room
        const existingRoom = roomList.find(r => r.participants.includes(initialTargetUserId));
        if (existingRoom) {
          setSelectedRoomId(existingRoom.id);
        } else {
          // Create new room
          try {
            const newRoomRef = await addDoc(collection(db, 'rooms'), {
              participants: [currentUser.userId, initialTargetUserId],
              updatedAt: serverTimestamp(),
              lastMessage: ''
            });
            setSelectedRoomId(newRoomRef.id);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'rooms');
          }
        }
      }
    });

    return unsubscribe;
  }, [currentUser.userId, initialTargetUserId]);

  useEffect(() => {
    setIsInitialLoad(true);
    setMsgLimit(50);
    setHasMore(true);
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;

    const q = query(
      collection(db, 'rooms', selectedRoomId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(msgLimit)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
      setMessages(newMessages);
      setHasMore(snap.docs.length === msgLimit);
    });

    return unsubscribe;
  }, [selectedRoomId, msgLimit]);

  useEffect(() => {
    // Maintain scroll position when more messages are loaded
    if (containerRef.current && loadingMore) {
      const scrollHeight = containerRef.current.scrollHeight;
      const scrollDiff = scrollHeight - lastScrollHeight.current;
      containerRef.current.scrollTop = scrollDiff;
      setLoadingMore(false);
    } else if (messages.length > 0 && isInitialLoad) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      setIsInitialLoad(false);
    } else if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore && !loadingMore) {
      setLoadingMore(true);
      lastScrollHeight.current = target.scrollHeight;
      setMsgLimit(prev => prev + 50);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoomId) return;
    if (!window.confirm("Are you sure you want to delete this conversation? This will remove the entire history for you.")) return;

    setDeletingRoom(true);
    try {
      await deleteDoc(doc(db, 'rooms', selectedRoomId));
      setSelectedRoomId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${selectedRoomId}`);
    } finally {
      setDeletingRoom(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedRoomId) return;
    try {
      await deleteDoc(doc(db, 'rooms', selectedRoomId, 'messages', messageId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${selectedRoomId}/messages/${messageId}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedRoomId) return;

    const text = inputText;
    setInputText('');

    try {
      await addDoc(collection(db, 'rooms', selectedRoomId, 'messages'), {
        senderId: currentUser.userId,
        text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `rooms/${selectedRoomId}/messages`);
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="h-full flex bg-black/20 overflow-hidden md:rounded-3xl border border-white/5">
      {/* Rooms List */}
      <aside className={cn(
        "w-full md:w-80 border-r border-white/5 flex flex-col bg-black/40",
        selectedRoomId ? "hidden md:flex" : "flex"
      )}>
        <header className="p-6 border-b border-white/5">
           <h2 className="text-xl font-serif mb-4">Conversations</h2>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20" />
             <input type="text" placeholder="Search chats..." className="w-full bg-white/5 border border-white/5 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold/30" />
           </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {rooms.map(room => (
            <button 
              key={room.id} 
              onClick={() => setSelectedRoomId(room.id)}
              className={cn(
                "w-full p-4 flex items-center gap-4 transition-all hover:bg-white/5",
                selectedRoomId === room.id ? "bg-gold/5 border-r border-gold" : ""
              )}
            >
              <Avatar
                name={room.otherUser?.displayName}
                src={room.otherUser?.photoURL}
                className="h-12 w-12 flex-shrink-0 rounded-full bg-white/10"
                textClassName="text-lg"
                presenceStatus={getPresence(room.otherUser?.userId).status}
                showPresence
              />
              <div className="text-left flex-1 min-w-0">
                <p className="font-serif text-white truncate">{room.otherUser?.displayName || 'Elite Member'}</p>
                <p className="text-xs text-platinum/40 truncate italic">{room.lastMessage || getPresenceText(room.otherUser?.userId)}</p>
              </div>
            </button>
          ))}
          {!loading && rooms.length === 0 && (
            <div className="p-12 text-center text-platinum/20 italic text-sm">
               No private circles established yet.
            </div>
          )}
        </div>
      </aside>

      {/* Chat Windows */}
      <main className={cn(
        "flex-1 flex flex-col bg-black/20",
        !selectedRoomId ? "hidden md:flex" : "flex"
      )}>
        {selectedRoomId ? (
          <>
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setSelectedRoomId(null)} 
                  className="md:hidden text-gold p-2 -ml-2"
                 >
                  <ChevronLeft className="w-6 h-6" />
                 </button>
                 <Avatar
                   name={selectedRoom?.otherUser?.displayName}
                   src={selectedRoom?.otherUser?.photoURL}
                   className="h-10 w-10 rounded-full border border-white/5 bg-white/10"
                   textClassName="text-sm"
                   presenceStatus={getPresence(selectedRoom?.otherUser?.userId).status}
                   showPresence
                 />
                 <div className="min-w-0">
                    <p className="font-serif text-white truncate max-w-[120px] sm:max-w-none">{selectedRoom?.otherUser?.displayName}</p>
                    <p className={cn("text-[10px] uppercase tracking-widest font-bold", getPresenceTone(getPresence(selectedRoom?.otherUser?.userId).status))}>
                      {getPresenceText(selectedRoom?.otherUser?.userId)}
                    </p>
                 </div>
              </div>
              <button 
                onClick={handleDeleteRoom}
                disabled={deletingRoom}
                className="p-2 text-platinum/20 hover:text-red-500 transition-colors bg-white/5 rounded-xl hover:bg-red-500/10"
                title="Delete Conversation"
              >
                {deletingRoom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </header>

            <div 
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
               {loadingMore && (
                 <div className="flex justify-center py-4">
                   <Loader2 className="w-5 h-5 text-gold animate-spin" />
                 </div>
               )}
               {messages.map(msg => (
                 <div key={msg.id} className={cn("flex group/msg", msg.senderId === currentUser.userId ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "relative max-w-[70%] p-4 rounded-2xl text-sm font-light leading-relaxed",
                      msg.senderId === currentUser.userId 
                        ? "bg-gold text-onyx rounded-tr-none" 
                        : "bg-white/5 text-platinum rounded-tl-none border border-white/5 backdrop-blur-sm"
                    )}>
                       {msg.text}
                       <div className={cn("text-[9px] mt-1 opacity-40", msg.senderId === currentUser.userId ? "text-onyx" : "text-platinum")}>
                          {msg.createdAt && formatDate(msg.createdAt.toDate())}
                       </div>

                       {msg.senderId === currentUser.userId && (
                         <button 
                           onClick={() => handleDeleteMessage(msg.id)}
                           className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 text-white/10 hover:text-red-500 opacity-0 group-hover/msg:opacity-100 transition-all"
                           title="Delete Message"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                 </div>
               ))}
               <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 md:p-6 bg-black/40 border-t border-white/5">
               <div className="relative group">
                 <input 
                   type="text" 
                   value={inputText}
                   onChange={(e) => setInputText(e.target.value)}
                   placeholder="Whisper something..." 
                   className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 md:py-4 pl-5 md:pl-6 pr-14 focus:outline-none focus:border-gold/40 transition-all font-light italic text-sm"
                 />
                 <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-gold hover:scale-110 transition-transform">
                    <Send className="w-5 h-5" />
                 </button>
               </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
             <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10 text-gold/20" />
             </div>
             <h2 className="text-2xl font-serif mb-2">Exclusive Dialogue</h2>
             <p className="text-platinum/40 italic font-light max-w-xs">Connecting members beyond the public square. Select a conversation to begin.</p>
          </div>
        )}
      </main>
    </div>
  );
}
