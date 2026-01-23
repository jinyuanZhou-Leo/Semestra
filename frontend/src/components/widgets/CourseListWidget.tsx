import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { Input } from '../Input';
import api from '../../services/api';
import type { Course } from '../../services/api';

interface CourseListWidgetProps {
    semesterId: number;
}

export const CourseListWidget: React.FC<CourseListWidgetProps> = ({ semesterId }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseCredits, setNewCourseCredits] = useState('0.5');
    const [newCourseGrade, setNewCourseGrade] = useState('0');

    useEffect(() => {
        fetchCourses();
    }, [semesterId]);

    const fetchCourses = async () => {
        // Current API for getSemester includes courses
        const data = await api.getSemester(semesterId);
        if (data.courses) setCourses(data.courses);
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createCourse(semesterId, {
                name: newCourseName,
                credits: parseFloat(newCourseCredits),
                grade_percentage: parseFloat(newCourseGrade),
                include_in_gpa: true
            });
            setIsModalOpen(false);
            setNewCourseName('');
            setNewCourseCredits('0.5');
            setNewCourseGrade('0');
            fetchCourses();
        } catch (error) {
            console.error("Failed to create course", error);
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
            }}>
                <h3 style={{ margin: 0 }}>Courses</h3>
                <Button onClick={() => setIsModalOpen(true)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>+ Add</Button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {courses.length === 0 ? (
                    <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '1rem' }}>No courses</div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {courses.map(course => (
                            <li key={course.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '0.75rem',
                                borderBottom: '1px solid var(--color-border)',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 500 }}>
                                        <Link
                                            to={`/courses/${course.id}`}
                                            style={{ color: 'var(--color-text-primary)', textDecoration: 'none' }}
                                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                            {course.name}
                                        </Link>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{course.credits} Credits</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600 }}>{course.grade_percentage}%</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>GPA: {course.grade_scaled}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to delete this course?')) {
                                                api.deleteCourse(course.id).then(fetchCourses).catch(err => console.error("Failed to delete", err));
                                            }
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--color-text-secondary)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '4px',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Course">
                <form onSubmit={handleCreateCourse}>
                    <Input label="Name" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required />
                    <Input label="Credits" type="number" step="0.5" value={newCourseCredits} onChange={e => setNewCourseCredits(e.target.value)} required />
                    <Input label="Grade (%)" type="number" step="0.1" value={newCourseGrade} onChange={e => setNewCourseGrade(e.target.value)} required />
                    <Button type="submit" fullWidth>Create Course</Button>
                </form>
            </Modal>
        </div>
    );
};
