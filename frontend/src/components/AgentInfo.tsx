import React from 'react';

interface AgentInfoProps {
  name: string;
  avatar: string;
  role: string;
}

const AgentInfo: React.FC<AgentInfoProps> = ({ name, avatar, role }) => {
  return (
    <div className="flex items-center mb-2 gap-2 sm:gap-3">
      <img src={avatar} alt="avatar" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mr-2 sm:mr-3" />
      <div>
        <div className="font-bold text-base sm:text-lg">{name}</div>
        <div className="text-xs sm:text-sm text-gray-500">{role}</div>
      </div>
    </div>
  );
};

export default AgentInfo;
