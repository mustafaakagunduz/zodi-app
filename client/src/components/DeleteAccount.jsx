import { useState } from 'react';
import { useStore } from '../store.jsx';
import Sheet from './Sheet.jsx';

export default function DeleteAccount() {
  const { deleteAccount } = useStore();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState({ busy: false, error: '' });

  const confirm = async () => {
    setStatus({ busy: true, error: '' });
    try {
      await deleteAccount();
    } catch (error) {
      setStatus({ busy: false, error: error.message });
    }
  };

  return (
    <>
      <button type="button" className="button danger-outline" onClick={() => setOpen(true)}>
        Hesabımı sil
      </button>
      {open && (
        <Sheet title="Hesabını sil" onClose={() => setOpen(false)}>
          <p>
            Profilin, sohbetlerin, mesajların, isteklerin ve engel listen kalıcı olarak silinecek.
            Sohbetler karşı tarafın listesinden de kalkacak. Bu işlem geri alınamaz.
          </p>
          {status.error && <p className="error" role="alert">{status.error}</p>}
          <div className="actions">
            <button type="button" className="button ghost" onClick={() => setOpen(false)}>Vazgeç</button>
            <button type="button" className="button danger" disabled={status.busy} onClick={confirm}>
              Kalıcı olarak sil
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
