import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error?: string;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onLogin(username, password);
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-fuchsia-900 to-blue-900 p-2">
      <form onSubmit={handleSubmit} className="bg-white/90 rounded-2xl shadow-2xl p-4 sm:p-8 flex flex-col gap-4 w-full max-w-xs sm:max-w-sm">
        <div className="text-xl sm:text-2xl font-bold text-fuchsia-700 mb-2 text-center">Live2D AI Agent Login</div>
        <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="p-2 rounded border border-gray-300 text-sm sm:text-base" autoComplete="username" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="p-2 rounded border border-gray-300 text-sm sm:text-base" autoComplete="current-password" />
        <button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded transition text-sm sm:text-base" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        {error && <div className="text-red-600 text-xs sm:text-sm text-center">{error}</div>}
        <div className="text-xs text-gray-500 text-center">Demo account: demo / demo</div>
      </form>
    </div>
  );
};

export default LoginPage;
