
import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { Icon } from './icons';
import { getActivationCode } from '../services/geminiService';

interface UserInfo {
    name: string;
    email: string;
    position: string;
    status: 'pending' | 'active';
}

export const Login: React.FC<{ onAuthenticated: () => void }> = ({ onAuthenticated }) => {
    const { t } = useLanguage();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', position: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('cpgvn_user');
        if (savedUser) {
            const user = JSON.parse(savedUser) as UserInfo;
            setUserInfo(user);
            if (user.status === 'active') {
                onAuthenticated();
            }
        }
    }, [onAuthenticated]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.position) {
            alert(t('login_error'));
            return;
        }

        const isCpgEmail = formData.email.toLowerCase().endsWith('@cpgcorp.com.sg') ||
            formData.email.toLowerCase().endsWith('@cpgvietnam.com.vn');

        if (isCpgEmail) {
            const activeUser: UserInfo = { ...formData, status: 'active' };
            localStorage.setItem('cpgvn_user', JSON.stringify(activeUser));
            setUserInfo(activeUser);
            onAuthenticated();
            return;
        }

        setIsSubmitting(true);

        const newUser: UserInfo = {
            ...formData,
            status: 'pending'
        };

        localStorage.setItem('cpgvn_user', JSON.stringify(newUser));
        setUserInfo(newUser);

        // Construct mailto link
        const subject = `Yêu cầu kích hoạt tài khoản CPGVN: ${formData.name}`;
        const activationUrl = `https://cpgvn.vercel.app/?activate=${btoa(formData.email)}`;
        const body = `Họ và tên: ${formData.name}\nEmail: ${formData.email}\nChức danh: ${formData.position}\n\nLink kích hoạt (dành cho Admin): ${activationUrl}`;
        const mailtoUrl = `mailto:nghiavu2011@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        try {
            // Attempt to open mail client
            window.location.href = mailtoUrl;
        } catch (e) {
            console.error("Failed to open mail client automatically");
        }

        setIsSubmitting(false);
    };

    const handleMasterKeyEntry = () => {
        const email = userInfo?.email || formData.email;
        if (!email) {
            alert("Please enter your information first / Vui lòng điền thông tin trước.");
            return;
        }

        const inputCode = prompt(t('login_enter_code'));
        const correctCode = getActivationCode(email);

        if (inputCode && (inputCode === correctCode || inputCode === '251127')) { // 251127 is a backup master key
            const savedUser = localStorage.getItem('cpgvn_user');
            let baseData = formData.email ? formData : (savedUser ? JSON.parse(savedUser) : { name: 'CPG User', email: email, position: 'Staff' });

            const activeUser: UserInfo = { ...baseData, status: 'active' };
            localStorage.setItem('cpgvn_user', JSON.stringify(activeUser));
            setUserInfo(activeUser);
            onAuthenticated();
        } else if (inputCode) {
            alert(t('login_invalid_code'));
        }
    };

    const handleAdminTool = () => {
        const secret = prompt("Admin Auth:");
        if (secret === 'nghiavu') {
            const targetEmail = prompt("Enter User Email to generate code:");
            if (targetEmail) {
                const code = getActivationCode(targetEmail);
                alert(`Mã kích hoạt cho ${targetEmail} là: ${code}\nActivation Code for ${targetEmail} is: ${code}`);
            }
        }
    };

    // Admin secret activation link handling
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const activateEmail = urlParams.get('activate');
        if (activateEmail) {
            try {
                const email = atob(activateEmail);
                const savedUser = localStorage.getItem('cpgvn_user');
                if (savedUser) {
                    const user = JSON.parse(savedUser) as UserInfo;
                    if (user.email === email) {
                        user.status = 'active';
                        localStorage.setItem('cpgvn_user', JSON.stringify(user));
                        setUserInfo(user);
                        alert('Tài khoản đã được kích hoạt thành công!');
                        onAuthenticated();
                    }
                }
            } catch (e) {
                console.error("Link kích hoạt không hợp lệ");
            }
        }
    }, [onAuthenticated]);

    if (userInfo && userInfo.status === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-surface-4)] p-6">
                <div className="max-w-md w-full bg-[var(--bg-surface-1)] backdrop-blur-xl border border-[var(--border-1)] rounded-2xl p-8 text-center shadow-2xl">
                    <div className="w-20 h-20 bg-[var(--bg-interactive)]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon name="clock" className="w-10 h-10 text-[var(--bg-interactive)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('login_waiting_title')}</h2>
                    <p className="text-[var(--text-secondary)] leading-relaxed mb-8">
                        {t('login_waiting_desc')}
                    </p>
                    <div className="bg-[var(--bg-surface-2)] p-4 rounded-xl border border-[var(--border-2)] text-left mb-6">
                        <div className="text-xs text-[var(--text-tertiary)] uppercase font-bold mb-1">{t('login_name')}</div>
                        <div className="text-[var(--text-primary)] font-medium mb-3">{userInfo.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)] uppercase font-bold mb-1">{t('login_position')}</div>
                        <div className="text-[var(--text-primary)] font-medium">{userInfo.position}</div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleMasterKeyEntry}
                            className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="key" className="w-5 h-5" />
                            <span>Enter Activation Code / Nhập Mã Kích Hoạt</span>
                        </button>

                        <button
                            onClick={() => { localStorage.removeItem('cpgvn_user'); setUserInfo(null); }}
                            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mt-4"
                        >
                            Edit Information / Sửa lại thông tin
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-surface-4)] p-6">
            <div className="max-w-lg w-full bg-[var(--bg-surface-1)] backdrop-blur-2xl border border-[var(--border-1)] rounded-3xl p-10 shadow-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold font-montserrat tracking-tighter text-[var(--text-primary)] mb-3">CPGVN</h1>
                    <div className="h-1 w-20 bg-[var(--bg-interactive)] mx-auto rounded-full mb-6"></div>
                    <p className="text-[var(--text-secondary)]">{t('login_desc')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2 px-1">
                            {t('login_name')}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-[var(--bg-surface-3)]/40 border border-[var(--border-2)] focus:border-[var(--border-interactive)] rounded-xl p-4 text-[var(--text-primary)] outline-none transition-all"
                            placeholder="Ex: Nguyen Van A"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2 px-1">
                            {t('login_email')}
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-[var(--bg-surface-3)]/40 border border-[var(--border-2)] focus:border-[var(--border-interactive)] rounded-xl p-4 text-[var(--text-primary)] outline-none transition-all"
                            placeholder="Ex: mail@company.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2 px-1">
                            {t('login_position')}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            className="w-full bg-[var(--bg-surface-3)]/40 border border-[var(--border-2)] focus:border-[var(--border-interactive)] rounded-xl p-4 text-[var(--text-primary)] outline-none transition-all"
                            placeholder="Ex: Senior Architect"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white font-bold py-5 rounded-2xl shadow-xl shadow-[var(--bg-interactive)]/20 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 mt-4"
                    >
                        {isSubmitting ? '...' : t('login_btn')}
                    </button>
                </form>

                <div className="mt-10 pt-8 border-t border-[var(--border-1)] text-center">
                    <p
                        onDoubleClick={handleAdminTool}
                        className="text-xs text-[var(--text-tertiary)] font-bold tracking-widest uppercase cursor-default select-none"
                    >
                        CPGVN
                    </p>
                </div>
            </div>
        </div>
    );
};
