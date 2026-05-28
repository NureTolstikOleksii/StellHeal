import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FaTimes, FaSpinner, FaPlus, FaTrash,
    FaRobot, FaUpload, FaFileMedical, FaFileImage, FaFile,
    FaPills, FaClock, FaSun, FaMoon, FaCloudSun, FaHeartbeat,
} from 'react-icons/fa';
import { MdSick } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import styles from './CreatePrescriptionPage.module.css';
import Toast from '../../components/Toast/Toast';
import AiFloatingChat from '../../components/AiFloatingChat/AiFloatingChat';

import {
    fetchAvailableWards, getPatientById,
    createPrescription, streamAiRecommendation, searchICDCodes,
} from '../../services/patientService';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay.jsx';

// ─── Константи ────────────────────────────────────────────────────────────────
const FILE_TYPES = [
    { value: 'analysis', label: 'Аналіз крові/сечі',  Icon: FaFileMedical },
    { value: 'xray',     label: 'Рентген',             Icon: FaFileImage   },
    { value: 'mri',      label: 'МРТ / КТ',            Icon: FaFileImage   },
    { value: 'ecg',      label: 'ЕКГ',                 Icon: FaHeartbeat   },
    { value: 'uzi',      label: 'УЗД',                 Icon: FaFileMedical },
    { value: 'other',    label: 'Інше',                Icon: FaFile        },
];

const TIME_SLOTS = {
    1: ['08:00'], 2: ['08:00','20:00'], 3: ['08:00','14:00','20:00'],
    4: ['08:00','12:00','16:00','20:00'], 5: ['08:00','10:00','13:00','16:00','20:00'],
    6: ['06:00','09:00','12:00','15:00','18:00','21:00'],
};

const getPeriod = (time) => {
    const h = parseInt(time.split(':')[0]);
    return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
};

const PERIOD_CONFIG = {
    morning:   { labelKey: 'morning',   range: '06:00 – 11:59', Icon: FaSun,      color: '#f59e0b' },
    afternoon: { labelKey: 'afternoon', range: '12:00 – 17:59', Icon: FaCloudSun, color: '#3b82f6' },
    evening:   { labelKey: 'evening',   range: '18:00 – 23:59', Icon: FaMoon,     color: '#6366f1' },
};

const PERIOD_LABELS = {
    uk: { morning: 'Ранок', afternoon: 'День', evening: 'Вечір' },
    en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
};

const addMinutes = (time, mins) => {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};

const buildSchedule = (medications) => {
    const entries = [];
    medications.forEach((med, medIdx) => {
        if (!med.medicationName || !med.timesPerDay) return;
        const slots = TIME_SLOTS[Math.min(parseInt(med.timesPerDay), 6)] || TIME_SLOTS[1];
        slots.forEach((time, slotIdx) => {
            entries.push({ id: `${medIdx}-${slotIdx}`, name: med.medicationName, time, quantity: med.quantity || 1, period: getPeriod(time) });
        });
    });
    entries.sort((a, b) => a.time.localeCompare(b.time));
    const used = {};
    entries.forEach(e => { while (used[e.time]) e.time = addMinutes(e.time, 30); used[e.time] = true; e.period = getPeriod(e.time); });
    return entries;
};

// ─── ICDSearch ────────────────────────────────────────────────────────────────
const ICDSearch = ({ value, onChange, placeholder, searchingText, notFoundText }) => {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => { setQuery(value || ''); }, [value]);

    const handleInput = (e) => {
        const val = e.target.value;
        setQuery(val); onChange(val); setOpen(true);
        clearTimeout(timerRef.current);
        if (val.length < 2) { setResults([]); return; }
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            try { const data = await searchICDCodes(val); setResults(data); }
            catch { setResults([]); }
            finally { setLoading(false); }
        }, 400);
    };

    const handleSelect = (item) => {
        const val = `${item.code} — ${item.name}`;
        setQuery(val); onChange(val); setOpen(false); setResults([]);
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <input type="text" className={styles.medInput} style={{ width: '100%', height: 38 }}
                   placeholder={placeholder} value={query} onChange={handleInput}
                   onFocus={() => results.length > 0 && setOpen(true)} autoComplete="off"
            />
            {open && (loading || results.length > 0 || query.length >= 2) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
                    {loading && <div style={{ padding: '12px 14px', color: '#9ca3af', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><FaSpinner className={styles.spinner} /> {searchingText}</div>}
                    {!loading && results.map(item => (
                        <div key={item.code} onMouseDown={() => handleSelect(item)}
                             style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fff', transition: 'background 0.1s' }}
                             onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                             onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1976d2', fontSize: 13, flexShrink: 0, background: '#eff6ff', padding: '2px 6px', borderRadius: 4, marginTop: 1 }}>{item.code}</span>
                            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{item.name}</span>
                        </div>
                    ))}
                    {!loading && results.length === 0 && query.length >= 2 && (
                        <div style={{ padding: '12px 14px', color: '#9ca3af', fontSize: 13 }}>{notFoundText}</div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── ScheduleItem / SchedulePreview ──────────────────────────────────────────
const ScheduleItem = ({ item, onTimeChange }) => (
    <div className={styles.scheduleItem}>
        <FaPills className={styles.scheduleItemIcon} />
        <div className={styles.scheduleItemName}>{item.name}</div>
        <div className={styles.scheduleItemQty}>{item.quantity} од.</div>
        <input type="time" className={styles.scheduleTime} value={item.time} onChange={e => onTimeChange(item.id, e.target.value)} />
    </div>
);

const SchedulePreview = ({ schedule, onScheduleChange, lang }) => {
    if (!schedule.length) return null;
    const { t } = useTranslation();
    const labels = PERIOD_LABELS[lang] || PERIOD_LABELS.uk;
    const handleTimeChange = (id, newTime) => {
        if (!newTime) return;
        onScheduleChange(schedule.map(s => s.id === id ? { ...s, time: newTime, period: getPeriod(newTime) } : s));
    };
    const periods = ['morning', 'afternoon', 'evening'];
    const byPeriod = periods.reduce((acc, p) => { acc[p] = schedule.filter(s => s.period === p); return acc; }, {});
    return (
        <div className={styles.schedulePreview}>
            <div className={styles.scheduleHeader}>
                <div className={styles.scheduleHeaderLeft}>
                    <FaClock className={styles.scheduleHeaderIcon} />
                    <span className={styles.scheduleTitle}>{t('prescription_form.schedule_title')}</span>
                </div>
            </div>
            {periods.map(period => {
                const items = byPeriod[period];
                if (!items.length) return null;
                const { range, Icon, color, labelKey } = PERIOD_CONFIG[period];
                return (
                    <div key={period} className={styles.schedulePeriod}>
                        <div className={styles.schedulePeriodHeader}>
                            <Icon style={{ color, fontSize: 15 }} />
                            <span className={styles.schedulePeriodLabel}>{labels[labelKey]}</span>
                            <span className={styles.schedulePeriodRange}>{range}</span>
                        </div>
                        {items.map(item => <ScheduleItem key={item.id} item={item} onTimeChange={handleTimeChange} />)}
                    </div>
                );
            })}
        </div>
    );
};

// ─── FileItem / SectionHeader ─────────────────────────────────────────────────
const FileItem = ({ file, index, onRemove, onTypeChange }) => {
    const ft = FILE_TYPES.find(t => t.value === file.fileType) || FILE_TYPES[0];
    return (
        <div className={styles.fileItem}>
            <ft.Icon className={styles.fileIcon} />
            <div className={styles.fileInfo}>
                <span className={styles.fileName}>{file.file.name}</span>
                <span className={styles.fileSize}>{(file.file.size / 1024).toFixed(0)} КБ</span>
            </div>
            <select className={styles.fileTypeSelect} value={file.fileType} onChange={e => onTypeChange(index, e.target.value)}>
                {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className={styles.fileRemoveBtn} onClick={() => onRemove(index)}><FaTimes size={11} /></button>
        </div>
    );
};

const SectionHeader = ({ icon: Icon, title, color = '#1976d2' }) => (
    <div className={styles.sectionHeader}>
        <div className={styles.sectionIconWrap} style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <Icon style={{ color, fontSize: 16 }} />
        </div>
        <h3 className={styles.sectionTitle}>{title}</h3>
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const CreatePrescriptionPage = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language || 'uk';
    const { id } = useParams();
    const navigate = useNavigate();

    const [patient, setPatient]               = useState(null);
    const [availableWards, setAvailableWards] = useState([]);
    const [complaints, setComplaints]         = useState('');
    const [anamnesis, setAnamnesis]           = useState('');
    const [objectiveStatus, setObjectiveStatus] = useState('');
    const [diagnosis, setDiagnosis]           = useState('');
    const [icdCode, setIcdCode]               = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [notes, setNotes]                   = useState('');
    const [wardId, setWardId]                 = useState('');
    const [medications, setMedications]       = useState([{ medicationName: '', quantity: '', timesPerDay: '', duration: '' }]);
    const [files, setFiles]                   = useState([]);
    const [schedule, setSchedule]             = useState([]);
    const [saving, setSaving]                 = useState(false);
    const [toast, setToast] = useState({ open: false, type: 'error', title: '', message: '' });

    // ref до плаваючого чату
    const chatRef      = useRef(null);
    const diagAbortRef = useRef(null);
    const medsAbortRef = useRef(null);
    const recAbortRef  = useRef(null);

    const showToast = (type, title, message = '') => setToast({ open: true, type, title, message });

    useEffect(() => {
        Promise.all([getPatientById(id), fetchAvailableWards()])
            .then(([p, wards]) => { setPatient(p); setAvailableWards(wards); })
            .catch(console.error);
    }, [id]);

    useEffect(() => () => {
        diagAbortRef.current?.abort();
        medsAbortRef.current?.abort();
        recAbortRef.current?.abort();
    }, []);

    useEffect(() => {
        const hasAny = medications.some(m => m.medicationName && m.timesPerDay);
        setSchedule(hasAny ? buildSchedule(medications) : []);
    }, [medications]);

    const patientPayload = () => ({
        age: patient?.dob ? String(new Date().getFullYear() - new Date(patient.dob).getFullYear()) : '',
    });

    // Контекст для чату
    const chatContext = patient
        ? `Пацієнт: ${patient.name}, вік: ${patientPayload().age} р.\nСкарги: ${complaints || 'не вказано'}\nАнамнез: ${anamnesis || 'не вказано'}\nОб'єктивний стан: ${objectiveStatus || 'не вказано'}\nДіагноз: ${diagnosis || 'не вказано'}\nПрепарати: ${medications.filter(m => m.medicationName).map(m => m.medicationName).join(', ') || 'не призначено'}`
        : '';

    // ── Стрімінг AI підказки в чат ───────────────────────────────────────────
    const requestAiToChat = async (type, payload, label, onApply, abortRef) => {
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        // Відкриваємо чат з порожньою підказкою — стрімитимемо туди
        chatRef.current?.openWithSuggestion(label, '', onApply);

        let acc = '';
        try {
            await streamAiRecommendation(type, payload, chunk => {
                acc += chunk;
                // Оновлюємо останнє повідомлення в чаті
                chatRef.current?.updateLastMessage(acc);
            }, abortRef.current.signal);
        } catch (e) {
            if (e.name !== 'AbortError') {
                chatRef.current?.updateLastMessage('Помилка підключення до AI.');
            }
        }
    };

    const suggestDiagnosis = () => requestAiToChat(
        'diagnosis',
        { ...patientPayload(), complaints, anamnesis, objectiveStatus },
        'Діагноз',
        (text) => setDiagnosis(text),
        diagAbortRef
    );

    const suggestMedications = () => requestAiToChat(
        'medications',
        { ...patientPayload(), diagnosis, complaints },
        'Препарати',
        null, // немає прямого apply для ліків
        medsAbortRef
    );

    const suggestRecommendations = () => requestAiToChat(
        'recommendations',
        { diagnosis, complaints, medications: medications.filter(m => m.medicationName).map(m => m.medicationName).join(', ') },
        'Рекомендації',
        (text) => setRecommendations(text),
        recAbortRef
    );

    const handleMedChange  = (i, f, v) => { const u = [...medications]; u[i][f] = v; setMedications(u); };
    const handleAddMed     = () => setMedications([...medications, { medicationName: '', quantity: '', timesPerDay: '', duration: '' }]);
    const handleRemoveMed  = (i) => setMedications(medications.filter((_, j) => j !== i));
    const handleFileAdd    = (e) => { setFiles(p => [...p, ...Array.from(e.target.files).map(f => ({ file: f, fileType: 'analysis' }))]); e.target.value = ''; };
    const handleFileRemove = (i) => setFiles(p => p.filter((_, j) => j !== i));
    const handleFileType   = (i, type) => { const u = [...files]; u[i].fileType = type; setFiles(u); };

    const handleSubmit = async () => {
        if (!diagnosis || !wardId) { showToast('error', t('prescription_form.error_required')); return; }
        if (medications.some(m => !m.medicationName || !m.quantity || !m.timesPerDay || !m.duration)) {
            showToast('error', t('prescription_form.error_medications')); return;
        }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('patientId', id); fd.append('diagnosis', diagnosis); fd.append('icd_code', icdCode);
            fd.append('wardId', wardId); fd.append('complaints', complaints); fd.append('anamnesis', anamnesis);
            fd.append('objective_status', objectiveStatus); fd.append('recommendations', recommendations);
            fd.append('notes', notes); fd.append('medications', JSON.stringify(medications));
            fd.append('schedule', JSON.stringify(schedule));
            files.forEach(f => { fd.append('files', f.file); fd.append('fileTypes', f.fileType); });
            await createPrescription(id, fd);
            showToast('success', t('prescription_form.save_success'));
            setTimeout(() => navigate(`/main/patients/${id}`), 1000);
        } catch (err) {
            showToast('error', t('prescription_form.error_save'), err?.response?.data?.message || '');
        } finally {
            setSaving(false);
        }
    };

    const calcAge = (dob) => dob ? String(new Date().getFullYear() - new Date(dob).getFullYear()) : '?';

    if (!patient) return <LoaderOverlay />;

    return (
        <div className={styles.pageWrapper}>

            <div className={styles.pageHeader}>
                <div>
                    <div className={styles.breadcrumb}>
                        <span className={styles.breadcrumbLink} onClick={() => navigate('/main/patients')}>{t('patients.title')}</span>
                        <span className={styles.breadcrumbSep}>/</span>
                        <span className={styles.breadcrumbLink} onClick={() => navigate(`/main/patients/${id}`)}>{patient.name}</span>
                        <span className={styles.breadcrumbSep}>/</span>
                        <span>{t('prescription_form.new_prescription')}</span>
                    </div>
                    <div className={styles.pageTitleRow}>
                        <h2 className={styles.pageTitle}>{t('prescription_form.new_prescription')}</h2>
                    </div>
                </div>
                <div className={styles.patientBadge}>
                    <img src={patient.avatar || '/default_avatar.svg'} alt="" className={styles.patientAvatar} />
                    <div>
                        <div className={styles.patientName}>{patient.name}</div>
                        <div className={styles.patientMeta}>{calcAge(patient.dob)} р. · {patient.phone}</div>
                    </div>
                </div>
            </div>

            <div className={styles.formBody}>

                {/* БЛОК 1 */}
                <div className={styles.formSection}>
                    <SectionHeader icon={MdSick} title={t('prescription_form.clinical_picture')} color="#e53935" />
                    <div className={styles.fieldRow}>
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>{t('prescription_form.complaints')}</label>
                            <textarea className={styles.textarea} rows={3} placeholder={t('prescription_form.complaints_placeholder')} value={complaints} onChange={e => setComplaints(e.target.value)} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>{t('prescription_form.anamnesis')}</label>
                            <textarea className={styles.textarea} rows={3} placeholder={t('prescription_form.anamnesis_placeholder')} value={anamnesis} onChange={e => setAnamnesis(e.target.value)} />
                        </div>
                    </div>
                    <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
                        <label className={styles.label}>{t('prescription_form.objective_status')}</label>
                        <textarea className={styles.textarea} rows={2} placeholder={t('prescription_form.objective_placeholder')} value={objectiveStatus} onChange={e => setObjectiveStatus(e.target.value)} />
                    </div>
                    <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
                        <div className={styles.labelRow}>
                            <label className={styles.label}>{t('prescription_form.diagnosis')}</label>
                            <button type="button" className={styles.aiTriggerBtn} onClick={suggestDiagnosis} disabled={!complaints && !anamnesis}>
                                <FaRobot size={12} /> {t('prescription_form.ai_hint')}
                            </button>
                        </div>
                        <textarea className={styles.textarea} rows={2} placeholder={t('prescription_form.diagnosis_placeholder')} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                    </div>
                    <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
                        <div className={styles.labelRow}>
                            <label className={styles.label}>
                                {t('prescription_form.icd_code')}
                                <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, textTransform: 'none', fontSize: 11 }}>{t('prescription_form.icd_hint')}</span>
                            </label>
                        </div>
                        <ICDSearch value={icdCode} onChange={setIcdCode} placeholder={t('prescription_form.icd_placeholder')} searchingText={t('prescription_form.icd_searching')} notFoundText={t('prescription_form.icd_not_found')} />
                    </div>
                </div>

                {/* БЛОК 2 */}
                <div className={styles.formSection}>
                    <SectionHeader icon={FaFileMedical} title={t('prescription_form.files_title')} color="#0288d1" />
                    <div className={styles.fileUploadArea}>
                        <label className={styles.fileUploadBtn}>
                            <FaUpload size={14} /><span>{t('prescription_form.upload_file')}</span>
                            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileAdd} hidden />
                        </label>
                        <span className={styles.fileHint}>{t('prescription_form.file_hint')}</span>
                    </div>
                    {files.length > 0 && <div className={styles.fileList}>{files.map((f, i) => <FileItem key={i} file={f} index={i} onRemove={handleFileRemove} onTypeChange={handleFileType} />)}</div>}
                </div>

                {/* БЛОК 3 */}
                <div className={styles.formSection}>
                    <SectionHeader icon={FaPills} title={t('prescription_form.treatment_title')} color="#2e7d32" />
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>{t('prescription_form.ward')}</label>
                        <select className={styles.select} value={wardId} onChange={e => setWardId(Number(e.target.value))}>
                            <option value="">{t('prescription_form.ward_placeholder')}</option>
                            {availableWards.map(w => <option key={w.id} value={w.id}>{t('prescription_form.ward')} {w.number}</option>)}
                        </select>
                    </div>
                    <div style={{ marginTop: 30, marginBottom: 40 }}>
                        <div className={styles.labelRow}>
                            <label className={styles.label}>{t('prescription_form.medications')}</label>
                            <button type="button" className={styles.aiTriggerBtn} onClick={suggestMedications} disabled={!diagnosis}>
                                <FaRobot size={12} /> {t('prescription_form.ai_hint')}
                            </button>
                        </div>
                        {medications.map((med, i) => (
                            <div key={i} className={styles.medRow}>
                                <div className={styles.medFields}>
                                    <div className={styles.medIndex}>{i + 1}</div>
                                    <input type="text"   className={styles.medInput} style={{ flex: 2.5 }} placeholder={t('prescription_form.med_name_placeholder')} value={med.medicationName} onChange={e => handleMedChange(i, 'medicationName', e.target.value)} />
                                    <input type="number" className={styles.medInput} placeholder={t('prescription_form.med_quantity')}  value={med.quantity}    onChange={e => handleMedChange(i, 'quantity',    e.target.value)} />
                                    <input type="number" className={styles.medInput} placeholder={t('prescription_form.med_times')}    value={med.timesPerDay} onChange={e => handleMedChange(i, 'timesPerDay', e.target.value)} />
                                    <input type="number" className={styles.medInput} placeholder={t('prescription_form.med_duration')} value={med.duration}    onChange={e => handleMedChange(i, 'duration',    e.target.value)} />
                                    <button className={styles.medRemoveBtn} onClick={() => handleRemoveMed(i)}><FaTrash size={12} /></button>
                                </div>
                            </div>
                        ))}
                        <button className={styles.addMedBtn} onClick={handleAddMed}><FaPlus size={12} /> {t('prescription_form.add_medication')}</button>
                    </div>
                    <SchedulePreview schedule={schedule} onScheduleChange={setSchedule} lang={lang} />
                    <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
                        <div className={styles.labelRow}>
                            <label className={styles.label}>{t('prescription_form.recommendations')}</label>
                            <button type="button" className={styles.aiTriggerBtn} onClick={suggestRecommendations} disabled={!diagnosis}>
                                <FaRobot size={12} /> {t('prescription_form.ai_hint')}
                            </button>
                        </div>
                        <textarea className={styles.textarea} rows={3} placeholder={t('prescription_form.recommendations_placeholder')} value={recommendations} onChange={e => setRecommendations(e.target.value)} />
                    </div>
                    <div className={styles.fieldGroup} style={{ marginTop: 20 }}>
                        <label className={styles.label}>{t('prescription_form.notes')}</label>
                        <textarea className={styles.textarea} rows={2} placeholder={t('prescription_form.notes_placeholder')} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                </div>

                <div className={styles.formActions}>
                    <button className={styles.cancelBtn} onClick={() => navigate(`/main/patients/${id}`)}>{t('common.cancel')}</button>
                    <button className={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
                        {saving ? <><FaSpinner className={styles.spinner} /> {t('prescription_form.saving')}</> : t('prescription_form.save')}
                    </button>
                </div>
            </div>

            {/* ── Плаваючий AI чат ── */}
            <AiFloatingChat ref={chatRef} context={chatContext} lang={lang} />

            <Toast open={toast.open} type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(t => ({ ...t, open: false }))} />
        </div>
    );
};

export default CreatePrescriptionPage;