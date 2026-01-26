
import React from 'react';
import { UserGuideModal } from './Shared';

interface GuideModalProps {
    onClose: () => void;
    language?: string;
}

const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
    return <UserGuideModal onClose={onClose} />;
};

export default GuideModal;
