import { Monitor } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { Badge } from '@/design-system';
import { useDisplayStore } from '@/stores/displayStore';
import { useEngineStore } from '@/stores/engineStore';

/** Brand at the left, glanceable status at the right. The centre belongs to the Dynamic Island. */
export function TopChrome() {
  const displayCount = useDisplayStore((s) => s.displays.length);
  const version = useEngineStore((s) => s.appInfo?.version);

  return (
    <>
      <div className="fixed top-4 left-7 z-30 flex items-center gap-3">
        <BrandMark size={28} />
        <span className="text-[15px] font-extrabold tracking-tight">Chira Launcher</span>
      </div>
      <div className="fixed top-4 right-7 z-30 flex items-center gap-2.5">
        <Badge title="Connected displays">
          <Monitor size={13} aria-hidden />
          {displayCount} {displayCount === 1 ? 'display' : 'displays'}
        </Badge>
        <Badge tone="success" title={version ? `Engine v${version}` : 'Engine'}>
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Engine ready
        </Badge>
      </div>
    </>
  );
}
