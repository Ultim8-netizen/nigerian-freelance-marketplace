'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ContestButtonProps {
  actionName: string; // e.g., "Withdrawal Hold" or "Trust Score Reduction"
}

export function ContestButton({ actionName }: ContestButtonProps) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const handleSubmit = async () => {
    if (explanation.length < 20) {
      return toast({ title: "Error", description: "Please provide a more detailed explanation.", variant: "destructive" });
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // FIXED: Added null check for user before attempting insert
    if (!user?.id) {
      setLoading(false);
      toast({ title: "Error", description: "You must be logged in to contest this action.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from('contest_tickets').insert({
      user_id: user.id,
      action_contested: actionName,
      explanation: explanation
    });

    setLoading(false);
    if (error) {
      toast({ title: "Submission Failed", description: "Could not file contest. Try again.", variant: "destructive" });
    } else {
      toast({ title: "Ticket Filed", description: "F9 will review your contest within 48 hours." });
      setExplanation('');
      setOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 hidden" id="contest-dialog" onClick={(e) => {
      if (e.target === e.currentTarget) setOpen(false);
    }}>
      {/* Trigger Button */}
      {!open && (
        <Button 
          variant="outline" 
          size="sm" 
          className="text-orange-600 border-orange-200"
          onClick={() => setOpen(true)}
        >
          Contest Decision
        </Button>
      )}

      {/* Dialog Overlay and Content */}
      {open && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border border-gray-200 bg-white p-6 shadow-lg rounded-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col space-y-4">
              {/* Header */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Contest Platform Action
                </h2>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You are contesting: <strong className="text-gray-900 dark:text-white">{actionName}</strong>.
                  <br />
                  Explain why this automated action should be reversed.
                </p>
                <Textarea
                  placeholder="I believe this was an error because..."
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? "Submitting..." : "Submit to F9 for Review"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}