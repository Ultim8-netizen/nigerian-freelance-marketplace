import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';

export default async function AdminConfigPage() {
  const supabase = await createClient();
  const { data: configs } = await supabase.from('platform_config').select('*').order('key');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Platform Configuration</h1>
      <p className="text-gray-500">Changes here apply immediately platform-wide without redeployment.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {configs?.map(config => (
          <Card key={config.key} className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-900 font-mono text-sm">{config.key}</h3>
                <p className="text-sm text-gray-500 mt-1">{config.description}</p>
              </div>
              {/* Note: This is read-only in Server Components. Needs Client Component for toggle interactions. */}
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {config.enabled ? 'ON' : 'OFF'}
              </div>
            </div>
            
            {(config.value !== null || config.string_value !== null) && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-600 font-medium">Threshold / Value:</span>
                <span className="bg-gray-100 px-3 py-1 rounded text-sm font-mono text-gray-800">
                  {config.value !== null ? config.value : config.string_value}
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}