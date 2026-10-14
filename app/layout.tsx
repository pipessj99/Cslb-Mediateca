import './globals.css';
export const metadata={title:'CSLB · Mediateca',description:'Un espacio para compartir, aprender y crear.',icons:{icon:'/logo.png'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}