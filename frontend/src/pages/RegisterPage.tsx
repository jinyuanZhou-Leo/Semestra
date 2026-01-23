import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { motion } from 'framer-motion';

export const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            // Register
            await axios.post('/api/auth/register', {
                email,
                password
            });

            // After register, login to get token
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const loginResponse = await axios.post('/api/auth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            login(loginResponse.data.access_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to register. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gradient-hero)',
            padding: '1rem'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '2.5rem',
                    backgroundColor: 'var(--color-bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--color-border)'
                }}
            >
                <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Create Account</h1>
                <p style={{
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                    marginBottom: '2rem',
                    fontSize: '0.875rem'
                }}>
                    Start managing your academic life with Semestra
                </p>

                <form onSubmit={handleSubmit}>
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                    <Input
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />

                    {error && (
                        <div style={{
                            color: 'var(--color-danger)',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating account...' : 'Register'}
                    </Button>
                </form>

                <p style={{
                    marginTop: '1.5rem',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)'
                }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                        Sign In
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};
