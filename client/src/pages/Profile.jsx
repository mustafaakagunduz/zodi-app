import AccountSettings from '../components/AccountSettings.jsx';
import BlockedList from '../components/BlockedList.jsx';
import DeleteAccount from '../components/DeleteAccount.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import ProfileForm from '../components/ProfileForm.jsx';
import UserCard from '../components/UserCard.jsx';
import { useStore } from '../store.jsx';

export default function Profile() {
  const { me, updateProfile, signOut, toast } = useStore();
  const leave = () => signOut().catch((error) => toast({ type: 'error', text: error.message }));
  return (
    <main className="page">
      <h1>Profilim</h1>
      <p className="muted">Adaylar seni böyle görüyor. Uyum skoru her kişiye göre ayrıca hesaplanır.</p>
      <UserCard user={me} as="section">
        <button type="button" className="button" disabled>Görüşme isteği at</button>
      </UserCard>
      <NotificationSettings />
      <h2>Profil bilgileri</h2>
      <ProfileForm initial={me} submitLabel="Kaydet" onSubmit={updateProfile} />
      <h2>Hesap ayarları</h2>
      <AccountSettings />
      <BlockedList />
      <h2>Gizlilik ve güvenlik</h2>
      <LegalLinks />
      <button type="button" className="button ghost" onClick={leave}>Çıkış yap</button>
      <DeleteAccount />
    </main>
  );
}
