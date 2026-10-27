import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { auth, db, loginWithEmail, registerWithEmail, logoutAccount } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [checkingWhitelist, setCheckingWhitelist] = useState(false);

  // Form Auth State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('soal');

  // Pantau Status Login Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkUserWhitelist(currentUser.email);
      } else {
        setIsWhitelisted(false);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Cek Whitelist ke Firestore
  const checkUserWhitelist = async (email) => {
    setCheckingWhitelist(true);
    try {
      const docRef = doc(db, 'whitelist', email.toLowerCase().trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().active === true) {
        setIsWhitelisted(true);
      } else {
        setIsWhitelisted(false);
      }
    } catch (error) {
      console.error("Gagal memeriksa whitelist:", error);
      setIsWhitelisted(false);
    } finally {
      setCheckingWhitelist(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    let res;
    if (isRegisterMode) {
      res = await registerWithEmail(emailInput, passwordInput);
    } else {
      res = await loginWithEmail(emailInput, passwordInput);
    }

    if (!res.success) {
      alert('Autentikasi Gagal: ' + res.error);
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await logoutAccount();
  };

  // API Key terpusat dari .env atau fallback
  const getApiKey = () => {
    return import.meta.env.VITE_GEMINI_API_KEY || '';
  };

  // State Generator Soal & Modul
  const [soalData, setSoalData] = useState({
    jenjang: 'SD/MI',
    kelas: 'Kelas 5',
    mapel: 'Matematika',
    topik: 'Pecahan Senilai',
    jumlahSoal: '5',
    bentukSoal: 'Pilihan Ganda',
    kesulitan: 'Sedang (Moderate)',
  });
  const [loadingSoal, setLoadingSoal] = useState(false);
  const [hasilSoal, setHasilSoal] = useState('');

  const [modulData, setModulData] = useState({
    jenjang: 'Madrasah Tsanawiyah (MTs)',
    kelas: 'Kelas 7 (Fase D)',
    mapel: 'Informatika',
    topikMateri: 'Berpikir Komputasional & Algoritma Hati Nurani',
    alokasiWaktu: '2 JP (2 x 35 Menit)',
    fokusPancaCinta: 'Cinta kepada Diri & Sesama (Empati & Sosial)',
  });
  const [loadingModul, setLoadingModul] = useState(false);
  const [hasilModul, setHasilModul] = useState('');

  const handleSoalChange = (e) => setSoalData({ ...soalData, [e.target.name]: e.target.value });
  const handleModulChange = (e) => setModulData({ ...modulData, [e.target.name]: e.target.value });

  // Generate Soal, Kisi-Kisi, dan Instrumen Penilaian
  const handleGenerateSoal = async (e) => {
    e.preventDefault();
    const apiKey = getApiKey();
    if (!apiKey) {
      alert('API Key Gemini sistem belum diset di file .env (VITE_GEMINI_API_KEY).');
      return;
    }

    setLoadingSoal(true);
    setHasilSoal('');

    const isSMA = 
      /10|11|12|X|XI|XII/i.test(soalData.kelas) || 
      /SMA|SMK|MA/i.test(soalData.jenjang);

    const opsiInstruction = isSMA 
      ? 'Opsi Jawaban Pilihan Ganda WAJIB 5 pilihan (A, B, C, D, E).' 
      : 'Opsi Jawaban Pilihan Ganda WAJIB 4 pilihan (A, B, C, D).';

    const opsiFormatExample = isSMA
      ? `A. Opsi A\nB. Opsi B\nC. Opsi C\nD. Opsi D\nE. Opsi E`
      : `A. Opsi A\nB. Opsi B\nC. Opsi C\nD. Opsi D`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
Bertindaklah sebagai Tim Penyusun Evaluasi Pembelajaran & Soal Ujian Kementerian Agama profesional.
Buatlah paket instrumen evaluasi pembelajaran lengkap dengan ketentuan:

INFORMASI DOKUMEN:
- Jenjang: ${soalData.jenjang}
- Kelas: ${soalData.kelas}
- Mata Pelajaran: ${soalData.mapel}
- Topik / Materi: ${soalData.topik}
- Jumlah Soal: ${soalData.jumlahSoal} butir
- Bentuk Soal: ${soalData.bentukSoal}
- Tingkat Kesulitan: ${soalData.kesulitan}

ATURAN STRUKTUR DOKUMEN (DILARANG MENGGUNAKAN SIMBOL TABEL PIPES "|" DAN GARIS "---"):

BAGIAN 1: KISI-KISI PENULISAN SOAL
Gunakan format daftar bernomor:
1. Nomor Soal: 1
   - Capaian Pembelajaran: ...
   - Indikator Soal: ...
   - Level Kognitif: (L1 / L2 / L3)
   - Bentuk Soal: ${soalData.bentukSoal}
(Lanjutkan berurutan sampai nomor ${soalData.jumlahSoal})

BAGIAN 2: NASKAH SOAL LENGKAP
Soal No. 1
Tuliskan pertanyaan/narasi soal secara jelas di sini...
${opsiFormatExample}

Soal No. 2
Tuliskan pertanyaan/narasi soal secara jelas di sini...
${opsiFormatExample}
(Lanjutkan urut sampai nomor ${soalData.jumlahSoal})
${opsiInstruction}

BAGIAN 3: KUNCI JAWABAN DAN PEMBAHASAN MENDALAM
Pembahasan No. 1. Kunci: [Misal: A]
- Pembahasan: Uraikan konsep materi, rumus/alasan ilmiah, dan langkah penyelesaian rinci.
(Lanjutkan urut sampai nomor ${soalData.jumlahSoal})

BAGIAN 4: INSTRUMEN DAN PEDOMAN PENILAIAN
- Teknik Penilaian: Tes Tertulis Objektif
- Pedoman Penskoran: Rumusan bobot skor tiap butir
- Rumus Nilai Akhir: (Skor Perolehan / Skor Maksimal) x 100
- Kriteria Ketuntasan & Interval Nilai: Predikat A, B, C, D
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let cleanedText = response.text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\n?(\d+\.\s+)/g, '\n\n$1')
        .replace(/\n?\s*([A-E]\.\s+)/g, '\n\n$1');

      setHasilSoal(cleanedText);
    } catch (error) {
      console.error(error);
      alert('Gagal membuat perangkat soal. Pastikan koneksi internet dan API Key valid.');
    } finally {
      setLoadingSoal(false);
    }
  };

  const handleResetSoal = () => {
    setSoalData({
      jenjang: 'SD/MI',
      kelas: 'Kelas 5',
      mapel: '',
      topik: '',
      jumlahSoal: '5',
      bentukSoal: 'Pilihan Ganda',
      kesulitan: 'Sedang (Moderate)',
    });
    setHasilSoal('');
  };

  // Generate Modul Ajar (KBC)
  const handleGenerateModul = async (e) => {
    e.preventDefault();
    const apiKey = getApiKey();
    if (!apiKey) {
      alert('API Key Gemini sistem belum diset di file .env (VITE_GEMINI_API_KEY).');
      return;
    }

    setLoadingModul(true);
    setHasilModul('');
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
Bertindaklah sebagai ahli kurikulum madrasah dan perancang pembelajaran profesional. Buatlah dokumen "MODUL AJAR KURIKULUM BERBASIS CINTA (KBC)" yang komprehensif dan rapi:
- Jenjang & Lembaga: ${modulData.jenjang}
- Kelas / Fase: ${modulData.kelas}
- Mata Pelajaran: ${modulData.mapel}
- Topik / Materi Utama: ${modulData.topikMateri}
- Alokasi Waktu: ${modulData.alokasiWaktu}
- Fokus Integrasi Panca Cinta Kemenag: ${modulData.fokusPancaCinta}

Ketentuan Format:
1. "1. IDENTITAS MODUL" WAJIB disajikan menggunakan format Tabel Markdown 2 Kolom.
2. Gunakan Heading Markdown (#, ##, ###) yang teratur.
3. Sertakan Asesmen dan Rubrik Penilaian dalam bentuk Tabel Markdown.
`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      setHasilModul(response.text);
    } catch (error) {
      console.error(error);
      alert('Gagal generate modul ajar.');
    } finally {
      setLoadingModul(false);
    }
  };

  const handleResetModul = () => {
    setModulData({
      jenjang: 'Madrasah Tsanawiyah (MTs)',
      kelas: 'Kelas 7 (Fase D)',
      mapel: '',
      topikMateri: '',
      alokasiWaktu: '',
      fokusPancaCinta: 'Cinta kepada Diri & Sesama (Empati & Sosial)',
    });
    setHasilModul('');
  };

  const exportToWord = (content, filename) => {
    if (!content) return;
    const printArea = document.getElementById('printable-content');
    const innerHTML = printArea ? printArea.innerHTML : content.replace(/\n/g, '<br/>');

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:Calibri,sans-serif;font-size:11pt;}table{border-collapse:collapse;width:100%;}table,th,td{border:1px solid #cbd5e1;padding:8px;}</style></head><body>`;
    const footer = "</body></html>";
    const blob = new Blob(['\ufeff' + header + innerHTML + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // TAMPILAN 1: AUTH
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
              🌱
            </div>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Buat Soal & Modul Otomatis Berbasis AI
            </span>
            <br></br>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Kurikulum Berbasis Cinta
            </span>
            <h1 className="text-2xl font-bold text-slate-800 mt-2">
              {isRegisterMode ? 'Daftar Akun Baru' : 'Login Pengguna'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Masukkan email terdaftar Anda untuk mengakses aplikasi.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="namaanda@gmail.com"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50"
            >
              {authLoading ? 'Memproses...' : isRegisterMode ? 'Daftar Akun' : 'Masuk ke Aplikasi'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              className="text-xs text-emerald-600 hover:underline font-medium"
            >
              {isRegisterMode ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar di sini'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TAMPILAN 2: WHITELIST CHECK
  if (checkingWhitelist) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-3"></div>
        <p className="text-sm text-slate-600 font-medium">Memeriksa hak akses lisensi akun Anda...</p>
      </div>
    );
  }

  if (!isWhitelisted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Akses Belum Diaktifkan</h1>
          <p className="text-slate-600 text-sm mt-2 mb-4">
            Email (<strong className="text-slate-900">{user.email}</strong>) belum terdaftar dalam daftar whitelist resmi.
          </p>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-500 mb-6 text-left">
            💡 <strong>Informasi:</strong> Hubungi admin untuk mengaktifkan lisensi akses akun Anda.
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl text-sm transition"
          >
            Keluar / Ganti Akun Lain
          </button>
        </div>
      </div>
    );
  }

  // TAMPILAN 3: UTAMA
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 relative flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 font-bold rounded-full flex items-center justify-center text-lg">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Masuk sebagai:</p>
              <p className="text-sm font-bold text-slate-800">{user.email}</p>
              <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5">
                ✓ Lisensi Aktif
              </span>
            </div>
          </div>

          <div>
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Title Banner & Navigation */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 text-center">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
            Modul KBC • Platform Edukasi Madrasah
          </span>
          <h1 className="text-3xl font-bold text-slate-800 mt-2">AI Assistant Perangkat Pembelajaran</h1>
          <p className="text-slate-500 text-sm mt-1">Generator Soal Ujian & Modul Ajar Berbasis Cinta (Kemenag)</p>

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => setActiveTab('soal')}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm ${activeTab === 'soal' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              📝 Generator Soal & Kisi-Kisi
            </button>
            <button
              onClick={() => setActiveTab('modul')}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm ${activeTab === 'modul' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              🌱 Generator Modul Ajar (KBC)
            </button>
          </div>
        </div>

        {/* TAB 1: GENERATOR SOAL */}
        {activeTab === 'soal' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-1">
              <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Parameter Soal</h2>
              <form onSubmit={handleGenerateSoal} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jenjang</label>
                  <select name="jenjang" value={soalData.jenjang} onChange={handleSoalChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white">
                    <option value="SD/MI">SD / MI</option>
                    <option value="SMP/MTs">SMP / MTs</option>
                    <option value="SMA/SMK/MA">SMA / SMK / MA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Kelas</label>
                  <input type="text" name="kelas" value={soalData.kelas} onChange={handleSoalChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
                  <input type="text" name="mapel" value={soalData.mapel} onChange={handleSoalChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Topik / Materi</label>
                  <textarea name="topik" value={soalData.topik} onChange={handleSoalChange} rows="2" className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jumlah</label>
                    <input type="number" name="jumlahSoal" min="1" max="20" value={soalData.jumlahSoal} onChange={handleSoalChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Bentuk</label>
                    <select name="bentukSoal" value={soalData.bentukSoal} onChange={handleSoalChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white">
                      <option value="Pilihan Ganda">Pilihan Ganda</option>
                      <option value="Essay / Uraian">Essay</option>
                      <option value="Campuran">Campuran</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Kesulitan</label>
                  <select name="kesulitan" value={soalData.kesulitan} onChange={handleSoalChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white">
                    <option value="Mudah (LOTS)">Mudah (LOTS)</option>
                    <option value="Sedang (Moderate)">Sedang</option>
                    <option value="Sulit & HOTS">Sulit / HOTS</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleResetSoal}
                    className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition text-sm"
                  >
                    🔄 Reset
                  </button>
                  <button
                    type="submit"
                    disabled={loadingSoal}
                    className="w-2/3 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow transition disabled:opacity-50 text-sm"
                  >
                    {loadingSoal ? 'Menyusun...' : '🚀 Buat Soal'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Dokumen Hasil Evaluasi</h2>
                {hasilSoal && (
                  <div className="flex gap-2">
                    <button onClick={() => exportToWord(hasilSoal, 'Perangkat_Soal_dan_Kisi_Kisi')} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1">
                      📥 Ekspor ke Word (.doc)
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(hasilSoal)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition">
                      📋 Salin
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-6 border border-slate-100 overflow-y-auto max-h-[600px]">
                {loadingSoal ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <p className="text-sm font-medium animate-pulse">Gemini sedang menyusun kisi-kisi, naskah soal & rubrik...</p>
                  </div>
                ) : hasilSoal ? (
                  <div id="printable-content" className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{hasilSoal}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                    <span className="text-4xl mb-2">📝</span>
                    <p className="text-sm font-medium text-slate-600">Belum ada paket evaluasi yang dibuat.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GENERATOR MODUL AJAR (KBC) */}
        {activeTab === 'modul' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-1">
              <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Parameter Modul (KBC)</h2>
              <form onSubmit={handleGenerateModul} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jenjang / Lembaga</label>
                  <select name="jenjang" value={modulData.jenjang} onChange={handleModulChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white">
                    <option value="Raudhatul Athfal (RA)">RA / TK</option>
                    <option value="Madrasah Ibtidaiyah (MI)">MI / SD</option>
                    <option value="Madrasah Tsanawiyah (MTs)">MTs / SMP</option>
                    <option value="Madrasah Aliyah (MA)">MA / SMA / SMK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Kelas / Fase</label>
                  <input type="text" name="kelas" value={modulData.kelas} onChange={handleModulChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
                  <input type="text" name="mapel" value={modulData.mapel} onChange={handleModulChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Topik / Materi Utama</label>
                  <textarea name="topikMateri" value={modulData.topikMateri} onChange={handleModulChange} rows="2" className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Alokasi Waktu</label>
                  <input type="text" name="alokasiWaktu" value={modulData.alokasiWaktu} onChange={handleModulChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Fokus Panca Cinta</label>
                  <select name="fokusPancaCinta" value={modulData.fokusPancaCinta} onChange={handleModulChange} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white">
                    <option value="Cinta kepada Allah (Transendental)">Cinta kepada Allah (Spiritual)</option>
                    <option value="Cinta kepada Diri & Sesama (Empati & Sosial)">Cinta kepada Diri & Sesama (Sosial)</option>
                    <option value="Cinta Alam & Lingkungan (Eco-Theology)">Cinta Alam & Lingkungan (Ekologis)</option>
                    <option value="Cinta Tanah Air & Budaya (Nasionalisme)">Cinta Tanah Air & Budaya</option>
                    <option value="Cinta Ilmu & Kerendahan Hati (Intelektual)">Cinta Ilmu & Kerendahan Hati</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleResetModul}
                    className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition text-sm"
                  >
                    🔄 Reset
                  </button>
                  <button
                    type="submit"
                    disabled={loadingModul}
                    className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow transition disabled:opacity-50 text-sm"
                  >
                    {loadingModul ? 'Merancang...' : '🌱 Buat Modul'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Dokumen Modul Ajar (KBC)</h2>
                {hasilModul && (
                  <div className="flex gap-2">
                    <button onClick={() => exportToWord(hasilModul, 'Modul_Ajar_KBC')} className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1">
                      📥 Ekspor ke Word (.doc)
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(hasilModul)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition">
                      📋 Salin
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-6 border border-slate-100 overflow-y-auto max-h-[600px]">
                {loadingModul ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <p className="text-sm font-medium animate-pulse">Gemini sedang merancang modul ajar...</p>
                  </div>
                ) : hasilModul ? (
                  <div id="printable-content" className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{hasilModul}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                    <span className="text-4xl mb-2">🌱</span>
                    <p className="text-sm font-medium text-slate-600">Belum ada Modul Ajar KBC yang dibuat.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;