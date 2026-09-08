import { useState } from "react";
import Login from "./Login.jsx";
import Humanizer from "./Humanizer.jsx";

const SESSION_KEY = "eh_authed";

export default function App() {
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  const login = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
    setAuthed(true);
  };
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    setAuthed(false);
  };

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className="grid-overlay" />
        <div className="orb a" />
        <div className="orb b" />
        <div className="orb c" />
      </div>
      <div className="page">
        {authed ? <Humanizer onLogout={logout} /> : <Login onSuccess={login} />}
      </div>
    </>
  );
}
