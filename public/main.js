import { achievementData, questionTemplates } from './data.js';
import { inquiryActivities } from './data1.js';

// === [여기서부터 아래 변수들까지 통째로 복사해서 기존 import 아래에 붙여넣기] ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 선생님의 Firebase 프로젝트 정보
const firebaseConfig = {
  apiKey: "AIzaSyDV_er1ecvJ6ll_6nqiHe10W7nX6kvEyt4",
  authDomain: "science-asa1-13844073-164bb.firebaseapp.com",
  projectId: "science-asa1-13844073-164bb",
  storageBucket: "science-asa1-13844073-164bb.firebasestorage.app",
  messagingSenderId: "946177749957",
  appId: "1:946177749957:web:c3a98314a79871d219d1ac"
};

// Firebase 실행
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자와 API Key를 기억해둘 공간
export let currentUser = null; 
export let userApiKey = ""; 
// ==============================================================================


document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    renderAchievementDashboard();
    initAnalysis();
    initInquiry();   // 선생님이 만드셨던 출판사 칩 필터링 복구!
    initModal();     // 선생님이 만드셨던 팝업(모달) 기능 복구!
    initFirebaseAuth(); // [추가할 부분: 로그인 기능 활성화 명령어]
    if (window.lucide) lucide.createIcons();
});

// 1. Navigation Logic (원본 복구)
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn, .tab-button');
    const sections = document.querySelectorAll('.content-section, .tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            const targetEl = document.querySelector(targetId) || document.getElementById(targetId.replace('#', ''));
            if (targetEl) targetEl.classList.add('active');
            
            if (targetId.includes('inquiry')) {
                renderInquiryActivities('전체');
            }
        });
    });
}

// 2. Modal Logic (원본 복구 - 문제 풀이는 팝업으로 예쁘게 뜹니다)
function initModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }
}

window.openModal = function(content) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (body && overlay) {
        body.innerHTML = content;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (window.lucide) lucide.createIcons();
    }
}

window.closeModal = function() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// 3. Dashboard Rendering (여기만 아코디언 방식으로 업그레이드!)
function renderAchievementDashboard() {
    const container = document.getElementById('unit-container') || document.getElementById('standards-container');
    if (!container) return;
    
    container.innerHTML = achievementData.map(unit => `
        <div class="unit-section" style="margin-bottom: 2.5rem;">
            <h3 style="font-size: 1.75rem; font-weight: 850; margin-bottom: 1.5rem; color: var(--text-main); border-bottom: 2px solid var(--border-color, #e2e8f0); padding-bottom: 0.5rem;">
                ${unit.unit}
            </h3>
            <div class="standards-list" style="display: flex; flex-direction: column; gap: 1rem;">
                ${unit.standards.map(s => `
                    <div class="standard-row" data-id="${s.id}" style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.3s;">
                        
                        <div class="std-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleAccordion(this)">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold; white-space: nowrap; flex-shrink: 0; width: 140px; text-align: center;">${s.id}</div>
                                <div class="std-info"><h4 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${s.description}</h4></div>
                            </div>
                            <div style="color: #2563eb; font-weight: bold; font-size: 1.2rem;">▼</div>
                        </div>
                        
                        <div class="std-levels" style="display: none; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #e2e8f0;">
                            ${Object.entries(s.levels).map(([level, desc]) => `
                                <div class="level-card" style="padding: 1.2rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.2s;" onclick="showDiagnosticQuestion('${s.id}', '${level}')" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e2e8f0'">
                                    <strong style="color: ${level === 'A' ? '#2563eb' : level === 'B' ? '#10b981' : level === 'C' ? '#f59e0b' : level === 'D' ? '#ef4444' : '#64748b'}; font-size: 1.1rem; display: block; margin-bottom: 0.4rem;">[${level} 수준]</strong>
                                    <span style="font-size: 0.95rem; color: #475569; line-height: 1.5; display: block;">${desc}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// 아코디언 토글 제어 함수 (하나 열면 다른 건 자동으로 닫힘)
window.toggleAccordion = function(element) {
    const row = element.closest('.standard-row');
    const levelsDiv = row.querySelector('.std-levels');
    const isCurrentlyOpen = levelsDiv.style.display === 'block';

    // 1. 모든 아코디언 닫기
    document.querySelectorAll('.std-levels').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.standard-row').forEach(r => r.style.borderColor = '#e2e8f0');

    // 2. 방금 클릭한 것만 열기
    if (!isCurrentlyOpen) {
        levelsDiv.style.display = 'block';
        row.style.borderColor = '#2563eb'; // 활성화된 테두리 파란색 강조
    }
};

// 4. Diagnostic Question (수능형 보기 추가)
window.showDiagnosticQuestion = function(standardId, level) {
    const templates = questionTemplates[standardId] && questionTemplates[standardId][level];
    
    if (!templates || templates.length === 0) {
        alert('해당 수준의 판별 문항이 아직 준비되지 않았습니다. 데이터를 추가해주세요.');
        return;
    }

    const q = templates[Math.floor(Math.random() * templates.length)];

    let conditionsHtml = '';
    if (q.conditions && q.conditions.length > 0) {
        conditionsHtml = `
            <div class="csat-box" style="border: 2px solid #cbd5e1; padding: 1.5rem; margin: 1.5rem 0; background: #fff; border-radius: 8px;">
                <div style="font-weight: bold; margin-bottom: 1rem; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">&lt;보 기&gt;</div>
                ${q.conditions.map(cond => `<div style="margin-bottom: 0.5rem; padding-left: 0.5rem;">${cond}</div>`).join('')}
            </div>
        `;
    }

    // [교체할 코드] SVG 코드를 인식하여 그림으로 변환해줍니다!
    let imageHtml = '';
    if (q.image) {
        if (q.image.trim().startsWith('<svg')) {
            imageHtml = `<div style="display: flex; justify-content: center; margin-bottom: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); padding: 1.5rem; background: white;">${q.image}</div>`;
        } else {
            imageHtml = `<img src="${q.image}" style="max-width: 100%; margin-bottom: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); display: block; margin: 0 auto;">`;
        }
    }

    const content = `
        <div class="question-container" style="padding: 1rem 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold;">${standardId}</div>
                <div style="font-weight: 800; color: white; background: #f59e0b; padding: 0.5rem 1.5rem; border-radius: 99px;">수준 ${level} 판정 문항</div>
            </div>
            
            <h3 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; line-height: 1.6; color: #0f172a;">${q.question}</h3>
            
            ${imageHtml}
            ${conditionsHtml}

            <div class="options-list" style="display: grid; gap: 0.75rem; margin-top: 1.5rem;">
                ${q.options.map((opt, idx) => `
                    <button class="option-btn" style="text-align: left; padding: 1rem 1.5rem; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; cursor: pointer; font-size: 1.05rem; transition: 0.2s;" onclick="checkAnswer(this, ${idx}, ${q.answer}, '${q.levelReason ? q.levelReason.replace(/'/g, "\\'") : ''}')">
                        <span style="display: inline-block; width: 28px; height: 28px; background: white; border-radius: 50%; text-align: center; line-height: 28px; margin-right: 10px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">${idx + 1}</span>
                        ${opt}
                    </button>
                `).join('')}
            </div>
            
            <div id="feedback-area"></div>
            
            <div id="reason-area" style="display:none; margin-top: 1.5rem; padding: 1.5rem; background: #f8fafc; border-left: 5px solid #2563eb; border-radius: 0 8px 8px 0;">
                <strong style="color: #2563eb; display: block; margin-bottom: 0.5rem;">💡 판정 이유 및 해설</strong>
                <p id="reason-text" style="font-size: 0.95rem; line-height: 1.6; margin: 0; color: #333;"></p>
            </div>
        </div>
    `;
    
    openModal(content);
};

window.checkAnswer = function(btn, selected, correct, reason) {
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.6';
        b.style.cursor = 'default';
    });
    btn.style.opacity = '1';

    const feedbackArea = document.getElementById('feedback-area');
    const reasonArea = document.getElementById('reason-area');
    const reasonText = document.getElementById('reason-text');

    if (selected === correct) {
        btn.style.borderColor = '#22c55e';
        btn.style.backgroundColor = '#f0fdf4';
        feedbackArea.innerHTML = `
            <div style="background: #22c55e; color: white; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; font-weight: bold; text-align: center; font-size: 1.1rem;">
                정답입니다! 👏 해당 수준을 잘 이해하고 계시네요.
            </div>
        `;
    } else {
        btn.style.borderColor = '#ef4444';
        btn.style.backgroundColor = '#fef2f2';
        buttons[correct].style.borderColor = '#22c55e';
        buttons[correct].style.backgroundColor = '#f0fdf4';
        buttons[correct].style.opacity = '1';
        feedbackArea.innerHTML = `
            <div style="background: #ef4444; color: white; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; font-weight: bold; text-align: center; font-size: 1.1rem;">
                아쉽습니다. 정답은 ${correct + 1}번입니다. 🤔
            </div>
        `;
    }

    if (reason) {
        reasonText.innerText = reason;
        reasonArea.style.display = 'block';
    }
};

// 5. Inquiry Logic (원본 복구 - 출판사 필터링 칩 완벽 작동)
function initInquiry() {
    const chips = document.querySelectorAll('.pub-chip');
    if (chips.length === 0) return;
    
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderInquiryActivities(chip.textContent);
        });
    });
}

function renderInquiryActivities(filter = '전체') {
    const container = document.getElementById('inquiry-list') || document.getElementById('inquiry-container');
    if (!container) return;
    
    let html = '';
    inquiryActivities.forEach(activity => {
        let matchingPublishers = activity.publishers;
        
        if (filter !== '전체') {
            matchingPublishers = activity.publishers.filter(p => p.name.includes(filter));
        }
        
        if (matchingPublishers.length > 0) {
            html += `
                <div class="inquiry-card" style="background: white; border-radius: 16px; padding: 2rem; margin-bottom: 2rem; border-left: 5px solid #7c3aed; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="margin-bottom: 1rem;">
                        <span class="std-id-badge" style="background: #f1f5f9; color: #475569; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.9rem; font-weight: bold;">${activity.standardId}</span>
                    </div>
                    <h4 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; color: #0f172a;">${activity.title}</h4>
                    <p style="font-size: 1rem; color: #64748b; margin-bottom: 1.5rem;">${activity.description || ''}</p>
                    
                    <div class="pub-list" style="display: grid; gap: 1rem;">
                        ${matchingPublishers.map(p => `
                            <div class="pub-item" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                    <strong style="font-size: 1.1rem; color: #333;">📑 ${p.name}</strong>
                                    ${p.downloadLink ? `<a href="${p.downloadLink}" style="color: #2563eb; text-decoration: none; font-weight: 700; font-size: 0.9rem;">활동지 다운로드</a>` : ''}
                                </div>
                                <p style="font-size: 0.95rem; color: #475569; line-height: 1.6; margin-bottom: 1rem;">${p.content}</p>
                                <div style="background: white; padding: 0.8rem 1rem; border-radius: 8px; font-size: 0.85rem; border: 1px dashed #7c3aed; color: #6d28d9; font-weight: 600;">
                                    준비물: ${p.materials}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

// 6. Analysis Logic (원본 복구)
// [수정할 코드: 기존 function initAnalysis() 전체를 아래 코드로 덮어쓰기]

function initAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultDiv = document.getElementById('analysis-result');
    
    // 텍스트 입력창(questionText) 관련 코드는 삭제되었습니다.

    // 이미지 요소들
    const btnUploadFile = document.getElementById('btn-upload-file');
    const btnUploadCamera = document.getElementById('btn-upload-camera');
    const fileInput = document.getElementById('file-input');
    const cameraInput = document.getElementById('camera-input');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const btnRemoveImage = document.getElementById('btn-remove-image');
    const uploadButtonsContainer = document.getElementById('upload-buttons-container');

    if (!analyzeBtn) return;

    // --- 이미지 처리 헬퍼 함수 ---
    const handleImageFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            selectedImageBase64 = e.target.result.split(',')[1];
            selectedImageMimeType = file.type;
            previewContainer.style.display = 'inline-block';
            uploadButtonsContainer.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };

    // --- 이벤트 리스너 ---
    btnUploadFile.addEventListener('click', () => fileInput.click());
    btnUploadCamera.addEventListener('click', () => cameraInput.click());
    fileInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
    cameraInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));

    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                handleImageFile(blob);
            }
        }
    });

    btnRemoveImage.addEventListener('click', () => {
        selectedImageBase64 = null;
        selectedImageMimeType = null;
        previewImg.src = '';
        previewContainer.style.display = 'none';
        uploadButtonsContainer.style.display = 'flex';
        fileInput.value = '';
        cameraInput.value = '';
    });

    // --- 문항 분석 실행 ---
    analyzeBtn.addEventListener('click', async () => {
        if (!currentUser) { alert('AI 문항 분석을 사용하려면 구글 로그인을 해주세요.'); return; }
        if (!userApiKey) { document.getElementById('api-modal-overlay').classList.add('active'); return; }

        if (!selectedImageBase64) {
            alert('분석할 문항 이미지를 업로드하거나 붙여넣기 해주세요.');
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.style.backgroundColor = "#94a3b8";
        analyzeBtn.innerHTML = `⏳ AI가 문항을 분석하고 풀이를 작성 중입니다...`;
        resultDiv.style.display = 'none';

        try {
            // [추가된 부분] data.js에 있는 선생님의 실제 성취기준 데이터를 텍스트로 변환합니다.
            const curriculumContext = achievementData.map(unit => 
                `단원: ${unit.unit}\n` + 
                unit.standards.map(s => 
                    `- 성취기준 코드: ${s.id}, 내용: ${s.description}\n` +
                    `  [성취수준] A: ${s.levels.A}, B: ${s.levels.B}, C: ${s.levels.C}, D: ${s.levels.D}, E: ${s.levels.E}`
                ).join('\n')
            ).join('\n\n');

            
            // [핵심] Gemini 프롬프트 고도화 (전 과목 확장 판별)
            const promptParts = [{
                text: `당신은 대한민국 고등학교 과학 교과 교육과정 및 평가 권위자입니다.
                우선적으로 아래 제공된 [2022 개정 교육과정 통합과학 공식 성취기준 데이터]를 확인하세요.

                [통합과학 공식 성취기준 데이터]
                ${curriculumContext}

                [분석 및 풀이 가이드라인]
                1. 과목 판정 및 성취기준 매칭: 
                   - 통합과학 문항인 경우: 위 데이터에서 정확히 일치하는 성취기준 코드를 찾아 매칭하세요.
                   - 타 과학 과목(물리학, 화학, 생명과학, 지구과학 등)인 경우: "데이터베이스에 준비 중"이라고 회피하지 마세요. 당신이 자체적으로 학습한 '2022 개정 고등학교 과학과 교육과정' 지식을 총동원하여, 해당 문항이 속한 가장 정확한 과목명과 성취기준(또는 핵심 개념)을 스스로 추론하여 명시하세요.
                2. 성취수준 판정: 해당 문항이 요구하는 사고의 수준을 분석하여 A~E 수준(또는 상/중/하)을 판정하고, 근거를 명확히 제시하세요.
                3. 고도화된 문항 풀이 (단계별 추론 강제):
                   - [중요] 처음부터 정답을 말하지 마세요.
                   - 반드시 1) 문제의 핵심 조건 분석 → 2) 적용할 심화 과학 원리 도출 → 3) 단계별 논리적 추론 및 계산(Step-by-step)의 과정을 거쳐 스스로 논리적 오류를 검증한 후 최종 정답을 제시하세요.
                
                결과는 반드시 아래 HTML 구조를 유지하여 반환해주세요 (마크다운 백틱 제외).

                [출력 HTML 형식]
                <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #bbf7d0;">
                    <p style="margin-bottom: 0.8rem;"><strong>분석 과목 및 단원:</strong> [과목명 및 단원명 기재]</p>
                    <p style="margin-bottom: 0.8rem;"><strong>매칭 성취기준:</strong> <span style="background: white; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #bbf7d0;">[성취기준 코드 또는 2022 개정 핵심 개념]</span></p>
                    <p style="margin-bottom: 0;"><strong>판정 성취수준:</strong> <strong style="color: #7c3aed; font-size: 1.1rem;">[A~E 또는 상/중/하]</strong></p>
                </div>
                
                <div style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
                    <strong style="color: #475569; display: block; margin-bottom: 0.5rem;">[⚖️ 교육과정 기반 판정 이유]</strong>
                    <p style="line-height: 1.7; color: #333; margin: 0;">[원칙에 근거한 엄격한 분석 내용 작성]</p>
                </div>
            
                <div style="background: #eff6ff; padding: 1.5rem; border-radius: 12px; border: 1px solid #bfdbfe;">
                    <strong style="color: #1d4ed8; display: block; margin-bottom: 0.5rem;">[🔬 고도화된 문항 풀이 및 심화 해설]</strong>
                    <p style="line-height: 1.7; color: #333; margin: 0;">[단계별 추론 과정이 포함된 학문적 깊이가 담긴 상세 풀이 작성]</p>
                </div>`
            }];

            if (selectedImageBase64) {
                promptParts.push({ inlineData: { mimeType: selectedImageMimeType, data: selectedImageBase64 } });
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${userApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: promptParts }] })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'API 호출 중 오류가 발생했습니다.');

            // AI가 만들어준 HTML(분석+풀이)을 그대로 화면에 띄웁니다.
            const aiResultHtml = data.candidates[0].content.parts[0].text;
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="card" style="border: 2px solid #22c55e; background: white; border-radius: 24px; padding: 2.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); margin-top: 2rem;">
                    <h3 style="color: #22c55e; margin-bottom: 1.5rem; font-size: 1.4rem; font-weight: 800;">AI 상세 분석 및 풀이 결과</h3>
                    ${aiResultHtml}
                </div>
            `;
        } catch (error) {
            console.error(error);
            alert(`분석 실패: ${error.message}`);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.style.backgroundColor = "var(--primary-color)";
            analyzeBtn.textContent = 'AI 문항 분석 시작';
        }
    });
}
// 전역 변수로 선택된 이미지를 저장할 변수 추가
let selectedImageBase64 = null;
let selectedImageMimeType = null;

function initFirebaseAuth() {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnApiSetup = document.getElementById('btn-api-setup');
    const userNameDisplay = document.getElementById('user-name-display');
    const apiModalOverlay = document.getElementById('api-modal-overlay');
    
    // 1. 로그인 상태 관찰
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            btnLogin.style.display = 'none';
            userNameDisplay.style.display = 'inline-block';
            userNameDisplay.textContent = `${user.displayName} 선생님`;
            btnLogout.style.display = 'inline-block';
            
            // DB에서 키 가져오기
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().apiKey) {
                userApiKey = docSnap.data().apiKey;
            }
        } else {
            currentUser = null;
            userApiKey = "";
            btnLogin.style.display = 'inline-block';
            userNameDisplay.style.display = 'none';
            btnLogout.style.display = 'none';
        }
    });

    // 2. 버튼 이벤트
    btnLogin.addEventListener('click', () => signInWithPopup(auth, provider));
    btnLogout.addEventListener('click', () => signOut(auth));
    
    // [핵심] API 설정 버튼 클릭 시 로그인 여부 확인
    btnApiSetup.addEventListener('click', () => {
        if (!currentUser) {
            alert("구글 로그인을 먼저 해주세요.");
            return;
        }
        document.getElementById('api-key-input').value = userApiKey; 
        apiModalOverlay.classList.add('active');
    });
    
    document.getElementById('api-modal-close').addEventListener('click', () => apiModalOverlay.classList.remove('active'));

    // 3. API Key 저장
    document.getElementById('btn-save-api').addEventListener('click', async () => {
        if (!currentUser) return;
        const newKey = document.getElementById('api-key-input').value.trim();
        if (!newKey) { alert("API Key를 입력해주세요."); return; }
        
        const btn = document.getElementById('btn-save-api');
        btn.textContent = "저장 중...";
        try {
            await setDoc(doc(db, "users", currentUser.uid), { apiKey: newKey, updatedAt: new Date() }, { merge: true });
            userApiKey = newKey;
            alert("개인 API Key가 데이터베이스에 안전하게 저장되었습니다!");
            apiModalOverlay.classList.remove('active');
        } catch (error) {
            alert("저장 실패: " + error.message);
        } finally {
            btn.textContent = "설정 저장하고 분석 시작하기";
        }
    });
}
// ====================================================================
// main.js 파일 하단에 아래 코드를 추가하여 챗봇 기능을 구현하세요.

// ----------------------------------------------------
// 챗봇 관련 요소 가져오기
// ----------------------------------------------------
const chatbotPanel = document.getElementById('chatbot-panel');
const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
const chatbotCloseBtn = document.getElementById('chatbot-close-button');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendBtn = document.getElementById('chatbot-send-button');
const chatbotMessages = document.getElementById('chatbot-messages');

// ----------------------------------------------------
// 챗봇 열기/닫기 기능
// ----------------------------------------------------
function toggleChatbot() {
  chatbotPanel.classList.toggle('chatbot-hidden');
}

chatbotToggleBtn.addEventListener('click', toggleChatbot);
chatbotCloseBtn.addEventListener('click', toggleChatbot);

// ----------------------------------------------------
// 메시지 추가 기능
// ----------------------------------------------------
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chatbot-message', sender);
  messageDiv.textContent = `${sender === 'user' ? '나: ' : '챗봇: '} ${text}`;
  chatbotMessages.appendChild(messageDiv);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight; // 스크롤을 맨 아래로 이동
}

// ----------------------------------------------------
// 메시지 전송 및 응답 처리
// ----------------------------------------------------
// ----------------------------------------------------
// 메시지 전송 및 응답 처리 (Gemini API 연동 버전)
// ----------------------------------------------------
// ----------------------------------------------------
// 메시지 전송 및 응답 처리 (Gemini API 연동 + 엄격한 전문가 모드)
// ----------------------------------------------------
async function sendMessage() {
    const messageText = chatbotInput.value.trim();
    if (!messageText) return;
  
    // 1. 로그인 및 API Key 확인
    if (!currentUser || !userApiKey) {
      alert('챗봇 기능을 사용하려면 구글 로그인 및 API Key 설정이 필요합니다.');
      document.getElementById('api-modal-overlay').classList.add('active');
      return;
    }
  
    // 2. 사용자의 질문을 화면에 표시
    addMessage(messageText, 'user');
    chatbotInput.value = ''; // 입력창 비우기
  
    // 3. 로딩 상태 표시 (답변 중복 클릭 방지)
    chatbotInput.disabled = true;
    chatbotSendBtn.disabled = true;
    chatbotSendBtn.textContent = '⏳';
    
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.classList.add('chatbot-message', 'bot');
    // 예쁜 애니메이션이 들어간 로딩창으로 변경
  loadingDiv.innerHTML = `
  <div class="typing-indicator">
    교육과정을 기반으로 답변 작성 중<span></span><span></span><span></span>
  </div>
`;
chatbotMessages.appendChild(loadingDiv);
chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    chatbotMessages.appendChild(loadingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  
    try {
      // 4. data.js의 성취기준 데이터를 챗봇에게 주입
      const curriculumContext = achievementData.map(unit => 
          unit.standards.map(s => `- ${s.id}: ${s.description}`).join('\n')
      ).join('\n');
  
      // 5. 프롬프트 설계 (수석 교사 수준의 고도화된 전문가 모드)
    const promptText = `
    당신은 대한민국 고등학교 과학 교과(통합과학, 물/화/생/지)의 엄격하고 뛰어난 수석 교사이자 평가 전문가입니다.
    
    [참고용 기준 데이터]
    ${curriculumContext}
    
    [대화 원칙 - 매우 중요]
    1. 확장된 전문성 발휘: 사용자의 질문이 제공된 데이터(통합과학)에 없더라도 "모른다"고 하지 마세요. 당신이 내재하고 있는 2022 개정 과학과 전 과목 지식을 총동원하여 최고 수준의 답변을 제공하세요.
    2. 논리적이고 풍부한 해설: 단답형으로 끝내지 마세요. 질문한 개념의 숨겨진 과학적 원리, 실생활 연계 예시, 학생들이 자주 헷갈리는 오개념 등 교육적으로 가치 있는 내용을 깊이 있게 덧붙여 설명하세요.
    3. 교육적 원칙 고수: 사용자의 논리나 가정이 틀렸다면 무조건 동조하지 말고, 과학적 사실과 교육과정의 원칙에 근거하여 친절하면서도 단호하게 교정 방향을 제시해 주세요.
    
    질문: "${messageText}"
  `;
  
      // 6. Gemini API 호출
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${userApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              contents: [{ parts: [{ text: promptText }] }] 
          })
      });
  
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'API 통신 오류');
  
      const botReply = data.candidates[0].content.parts[0].text;
  
      // 7. 화면에 답변 출력
      document.getElementById(loadingId).remove();
      const replyDiv = document.createElement('div');
      replyDiv.classList.add('chatbot-message', 'bot');
      
      // 마크다운 문법 중 불필요한 별표(**)를 지우고 줄바꿈 적용
      let formattedReply = botReply.replace(/\*\*/g, '').replace(/\n/g, '<br>');
      replyDiv.innerHTML = formattedReply; 
      chatbotMessages.appendChild(replyDiv);
  
    } catch (error) {
      console.error(error);
      document.getElementById(loadingId).remove();
      addMessage(`⚠️ 죄송합니다. 답변을 가져오는 중 오류가 발생했습니다: ${error.message}`, 'bot');
    } finally {
      // 8. 입력창 잠금 해제
      chatbotInput.disabled = false;
      chatbotSendBtn.disabled = false;
      chatbotSendBtn.textContent = '전송';
      chatbotInput.focus();
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
  }
  
  
  // (참고: 아래에 있던 이벤트 리스너 코드는 그대로 두시면 됩니다.)
  // chatbotSendBtn.addEventListener('click', sendMessage);
  // chatbotInput.addEventListener('keypress', (event) => { ... });

chatbotSendBtn.addEventListener('click', sendMessage);
chatbotInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});
// ====================================================================
// [추가할 부분] 플로팅 버튼 기능 및 화면 초기화 로직
// ====================================================================

// '맨 위로' 버튼 클릭 시
document.getElementById('btn-scroll-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// '다른 문항 분석하기' 버튼 클릭 시 (완전 초기화)
document.getElementById('btn-reset-analysis')?.addEventListener('click', () => {
    // 1. 화면 맨 위로 부드럽게 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 2. 분석 결과창 숨기기
    const resultDiv = document.getElementById('analysis-result');
    if(resultDiv) resultDiv.style.display = 'none';
    
    // 3. 첨부된 이미지 삭제 (기존에 만들어둔 X버튼 강제 클릭)
    const removeImgBtn = document.getElementById('btn-remove-image');
    if(removeImgBtn) removeImgBtn.click();

    // 4. 입력창 텍스트 비우기
    const questionInput = document.getElementById('question-text');
    if(questionInput) questionInput.value = '';
    
    // 5. 챗봇 대화 내용 비우기 및 초기 안내 메시지 띄우기
    const chatMessages = document.getElementById('chatbot-messages');
    if(chatMessages) {
        chatMessages.innerHTML = `
            <div class="chatbot-message bot" style="background-color: #e0f2fe; border-left: 4px solid #0284c7;">
                <strong style="display:block; margin-bottom:5px; font-size:0.85rem; color:#0369a1;">통합과학 도우미</strong>
                <div>새로운 문항 분석 준비가 완료되었습니다! 분석 결과를 보신 후 무엇이든 물어보세요.</div>
            </div>`;
    }
});
