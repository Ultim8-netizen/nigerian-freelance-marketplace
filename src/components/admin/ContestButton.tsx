'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ContestButtonProps {
  actionContested: string;
}

export function ContestButton({ actionContested }: ContestButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!explanation.trim()) return;
    setIsSubmitting(true);
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from('contest_tickets').insert({
        user_id: user.id,
        action_contested: actionContested,
        explanation: explanation,
      });

      if (!error) {
        toast({ title: 'Ticket submitted', description: 'Our team will review this shortly.' });
        setIsOpen(false);
      } else {
        toast({ title: 'Error', description: 'Failed to submit ticket.', variant: 'destructive' });
      }
    }
    setIsSubmitting(false);
  };

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="text-gray-500 mt-2">
        <ShieldAlert className="w-4 h-4 mr-2" />
        This is a mistake
      </Button>
    );
  }

  return (
    <div className="mt-3 p-4 bg-gray-50 border rounded-lg">
      <p className="text-sm font-medium mb-2">Explain why this action is incorrect:</p>
      <Textarea 
        value={explanation} 
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Provide context..."
        className="mb-3"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          <Send className="w-4 h-4 mr-2" /> Submit to Review
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}