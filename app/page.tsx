import Mediateca from './mediateca';
import AuthGate from './auth-gate';
export default function Page(){return <AuthGate><Mediateca/></AuthGate>}
