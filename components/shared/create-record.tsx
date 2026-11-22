'use client';
import { saveEntityAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Entity } from '@/lib/services/admin';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EntityForm, type Field } from './entity-form';
export function CreateRecord({
  entity,
  title,
  fields,
  defaults,
  id,
}: {
  entity: Entity;
  title: string;
  fields: Field[];
  defaults?: Record<string, unknown>;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={id ? 'outline' : 'default'} onClick={() => setOpen(true)}>
        {!id && <Plus size={17} />}
        {title}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={title}>
        <EntityForm
          fields={fields}
          defaults={defaults}
          action={(v) => saveEntityAction(entity, v, id)}
          label={id ? 'Save changes' : title}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
