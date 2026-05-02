import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, FileCode2, Paperclip, ImageIcon, FileText, X } from 'lucide-react';
import { Avatar } from '../shared/Avatar';
import { format, isToday, isYesterday } from 'date-fns';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import LogSnippetView from './LogSnippetView';
import Modal from '../shared/Modal';

const LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'python', 'bash',
  'json', 'yaml', 'sql', 'java', 'go', 'rust', 'css', 'html',
];

const formatMsgTime = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
};

const SystemMessage = ({ msg }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="flex-1 h-px bg-slate-800" />
    <p className="text-xs text-slate-600 flex-shrink-0">{msg.content}</p>
    <div className="flex-1 h-px bg-slate-800" />
  </div>
);

const FileMessage = ({ msg, isOwn }) => {
  const { meta } = msg;
  const isImage = meta?.mimetype?.startsWith('image/');

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} group`}>
      <Avatar user={msg.sender} size="sm" className="flex-shrink-0 mt-0.5" />
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-center gap-2 flex-wrap">
          {!isOwn && <span className="text-xs font-medium text-slate-400">{msg.sender?.name}</span>}
          <span className="text-xs text-slate-600">{formatMsgTime(msg.createdAt)}</span>
        </div>
        <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'border-blue-500/30 bg-blue-600/10 rounded-tr-sm' : 'border-slate-700/50 bg-slate-800 rounded-tl-sm'}`}>
          {isImage ? (
            <a href={meta?.url} target="_blank" rel="noreferrer">
              <img
                src={meta?.url}
                alt={meta?.filename}
                className="max-w-xs max-h-64 object-contain block"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </a>
          ) : (
            <a
              href={meta?.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3.5 py-2.5 hover:bg-slate-700 transition-all"
            >
              <FileText size={14} className="text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-200 truncate">{meta?.filename || msg.content}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatMessage = ({ msg, isOwn }) => {
  if (msg.type === 'file') return <FileMessage msg={msg} isOwn={isOwn} />;

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} group`}>
      <Avatar user={msg.sender} size="sm" className="flex-shrink-0 mt-0.5" />
      <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-center gap-2 flex-wrap">
          {!isOwn && <span className="text-xs font-medium text-slate-400">{msg.sender?.name}</span>}
          <span className="text-xs text-slate-600">{formatMsgTime(msg.createdAt)}</span>
        </div>

        {msg.type === 'log_snippet' ? (
          <LogSnippetView
            content={msg.content}
            language={msg.meta?.language || 'plaintext'}
            filename={msg.meta?.filename}
          />
        ) : (
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
              isOwn
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm'
            }`}
          >
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
};

const TypingIndicator = ({ users }) => {
  if (!users.length) return null;
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-600">
        {users.map((u) => u.name).join(', ')} {users.length === 1 ? 'is' : 'are'} typing…
      </span>
    </div>
  );
};

/**
 * Modal: Paste Log Snippet
 */
const PasteLogModal = ({ isOpen, onClose, onSubmit }) => {
  const [logContent, setLogContent] = useState('');
  const [language, setLanguage] = useState('plaintext');
  const [filename, setFilename] = useState('');

  const handleSubmit = () => {
    if (!logContent.trim()) return;
    onSubmit({ content: logContent.trim(), language, filename: filename.trim() || undefined });
    setLogContent('');
    setFilename('');
    setLanguage('plaintext');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Paste Log / Code Snippet" size="lg">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-base"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-slate-900">
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Filename (optional)</label>
            <input
              type="text"
              placeholder="e.g. error.log"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="input-base"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Paste your log or code</label>
          <textarea
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            placeholder="Paste error logs, stack traces, or code here…"
            rows={12}
            className="input-base resize-none font-mono text-xs"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!logContent.trim()}
            className="btn-primary flex-1 justify-center disabled:opacity-40"
          >
            <FileCode2 size={14} />
            Share Snippet
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Main Chat component -----------------------------------------------
const Chat = ({ roomId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const socket = getSocket();

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load message history
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}/messages`);
        setMessages(data.messages);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Socket listeners
  useEffect(() => {
    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on('user_typing', ({ user: u }) => {
      setTyping((prev) => (prev.find((t) => t._id === u._id) ? prev : [...prev, u]));
    });
    socket.on('user_stopped_typing', ({ userId }) => {
      setTyping((prev) => prev.filter((u) => u._id !== userId));
    });

    return () => {
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
    };
  }, [socket]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    socket.emit('typing_start', { roomId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { roomId });
    }, 1500);
  };

  const sendMessage = () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    socket.emit('send_message', { roomId, content, messageType: 'message' });
    setInput('');
    socket.emit('typing_stop', { roomId });
    clearTimeout(typingTimeoutRef.current);
    setTimeout(() => setSending(false), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogSubmit = ({ content, language, filename }) => {
    socket.emit('send_message', {
      roomId,
      content,
      messageType: 'log_snippet',
      meta: { language, filename },
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/rooms/${roomId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Broadcast uploaded file message to room via socket
      socket.emit('file_uploaded', { roomId, message: data.message });
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-600 text-sm">No messages yet. Start the incident coordination.</p>
            </div>
          )}
          {messages.map((msg) =>
            msg.type === 'system' ? (
              <SystemMessage key={msg._id} msg={msg} />
            ) : (
              <ChatMessage
                key={msg._id}
                msg={msg}
                isOwn={msg.sender?._id === user?._id || msg.sender === user?._id}
              />
            )
          )}
          <TypingIndicator users={typing.filter((u) => u._id !== user?._id)} />
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-end gap-2">
            {/* File upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,text/plain,text/x-log,application/json"
              className="hidden"
              onChange={handleFileUpload}
              id="file-upload-input"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload image or file"
              className="btn-ghost p-2.5 flex-shrink-0 disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Paperclip size={15} />
              )}
            </button>

            {/* Paste log */}
            <button
              onClick={() => setShowLogModal(true)}
              title="Paste log snippet"
              className="btn-ghost p-2.5 flex-shrink-0"
            >
              <FileCode2 size={15} />
            </button>

            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              className="input-base flex-1 resize-none max-h-28 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="btn-primary px-3 py-2.5 flex-shrink-0 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-xs text-slate-700 mt-1.5 ml-1">Shift+Enter for new line</p>
        </div>
      </div>

      <PasteLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSubmit={handleLogSubmit}
      />
    </>
  );
};

export default Chat;
