'use client';

import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Send } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string, mentions: string[]) => void;
  projectId: string;
  placeholder?: string;
  disabled?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  projectId,
  placeholder = 'Skriv en kommentar... Bruk @ for å nevne noen',
  disabled = false,
}: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch project members
  useEffect(() => {
    if (projectId) {
      fetchProjectMembers();
    }
  }, [projectId]);

  const fetchProjectMembers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch project members:', error);
    }
  };

  // Handle text change and detect @ mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space after @, if so, don't show suggestions
      if (!textAfterAt.includes(' ')) {
        setMentionStart(lastAtIndex);
        setMentionQuery(textAfterAt.toLowerCase());
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
  };

  // Filter suggestions based on query
  const filteredSuggestions = suggestions.filter(user =>
    (user.name?.toLowerCase().includes(mentionQuery) ||
     user.email.toLowerCase().includes(mentionQuery))
  );

  // Insert mention
  const insertMention = (user: User) => {
    if (mentionStart === null) return;

    const displayName = user.name || user.email.split('@')[0];
    const beforeMention = value.substring(0, mentionStart);
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const afterCursor = value.substring(cursorPosition);
    
    const newValue = `${beforeMention}@${displayName} ${afterCursor}`;
    onChange(newValue);
    setShowSuggestions(false);
    
    // Set cursor after mention
    setTimeout(() => {
      const newPosition = mentionStart + displayName.length + 2;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
      textareaRef.current?.focus();
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          Math.min(prev + 1, filteredSuggestions.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredSuggestions[selectedIndex]) {
          insertMention(filteredSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Extract mentions from text
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];
    
    // Match against actual users
    const mentionedUsers: string[] = [];
    matches.forEach(match => {
      const name = match.substring(1);
      const user = suggestions.find(u => 
        u.name?.toLowerCase() === name.toLowerCase() ||
        u.email.split('@')[0].toLowerCase() === name.toLowerCase()
      );
      if (user) {
        mentionedUsers.push(user.id);
      }
    });
    
    return mentionedUsers;
  };

  const handleSubmit = () => {
    if (!value.trim()) return;
    const mentions = extractMentions(value);
    onSubmit(value, mentions);
  };

  return (
    <div className="relative space-y-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="resize-none"
      />

      {/* Mention suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <Card 
          ref={suggestionsRef}
          className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto z-10 border shadow-lg"
        >
          <div className="p-1">
            {filteredSuggestions.map((user, index) => (
              <button
                key={user.id}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                }`}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium">{user.name || user.email.split('@')[0]}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Bruk @ for å nevne teammedlemmer. Ctrl+Enter for å sende.</span>
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          size="sm"
        >
          <Send className="w-4 h-4 mr-1" />
          Send
        </Button>
      </div>
    </div>
  );
}
