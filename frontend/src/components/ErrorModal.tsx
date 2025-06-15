import React from 'react';

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-xl min-w-[220px] max-w-xs w-full shadow-xl flex flex-col items-center">
        <div className="mb-3 text-center text-sm text-gray-800">{message}</div>
        <button onClick={onClose} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-1 rounded transition text-xs sm:text-base">Close</button>
      </div>
    </div>
  );
};

export default ErrorModal;
