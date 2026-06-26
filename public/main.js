// === Firebase 초기화 및 필수 모듈 세팅 ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// 👇 맨 끝에 getDocs, query, where를 추가했습니다.
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV_er1ecvJ6ll_6nqiHe10W7nX6kvEyt4",
  authDomain: "science-asa1-13844073-164bb.firebaseapp.com",
  projectId: "science-asa1-13844073-164bb",
  storageBucket: "science-asa1-13844073-164bb.firebasestorage.app",
  messagingSenderId: "946177749957",
  appId: "1:946177749957:web:c3a98314a79871d219d1ac"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.collection = collection;
window.addDoc = addDoc;

export let currentUser = null; 
export let userApiKey = ""; 

// 전역 변수
let selectedImageBase64 = null;
let selectedImageMimeType = null;


document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    renderAchievementDashboard();
    initAnalysis();
    initInquiry();   
    initModal();     
    initFirebaseAuth(); 
    if (window.lucide) lucide.createIcons();
    initChatbotResize();
});


// 1. Navigation Logic
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

// 2. Modal Logic
// 2. Modal Logic
function initModal() {
    // 기존 기본 모달 닫기
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // 💡 [수정됨] DB 저장 팝업창 닫기 기능 추가
    const saveModalOverlay = document.getElementById('save-modal-overlay');
    // X 버튼 (클래스가 close-btn이거나 id가 save-modal-close인 요소 찾기)
    const saveModalCloseBtn = document.querySelector('#save-modal-overlay .close-btn') || document.getElementById('save-modal-close');
    
    if (saveModalCloseBtn) {
        saveModalCloseBtn.addEventListener('click', () => {
            if (saveModalOverlay) saveModalOverlay.classList.remove('active');
        });
    }
    // 배경(어두운 부분) 클릭 시 닫기
    if (saveModalOverlay) {
        saveModalOverlay.addEventListener('click', (e) => {
            if (e.target === saveModalOverlay) saveModalOverlay.classList.remove('active');
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

// 3. Dashboard Rendering (기존 함수를 찾아 아래 내용으로 완전히 덮어쓰세요)
async function renderAchievementDashboard(selectedCourse = "1. 통합과학1") {
    const container = document.getElementById('unit-container') || document.getElementById('standards-container');
    if (!container) return;
    
    // 데이터를 불러오는 동안 보여줄 로딩 메시지
    container.innerHTML = '<div style="text-align:center; padding: 3rem; font-size: 1.2rem; color: #64748b;">데이터베이스에서 성취기준을 불러오는 중입니다... ⏳</div>';

    try {
        // 파이어베이스에서 선택된 과목(selectedCourse)의 데이터만 쏙 뽑아옵니다.
        const q = query(collection(db, "standards"), where("course", "==", selectedCourse));
        const querySnapshot = await getDocs(q);
        
        const standardsData = [];
        querySnapshot.forEach((doc) => {
            standardsData.push(doc.data());
        });

        if (standardsData.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">등록된 성취기준 데이터가 없습니다.</div>';
            return;
        }

        // 단원명(unit)을 기준으로 데이터를 묶어줍니다.
        const groupedData = {};
        standardsData.forEach(std => {
            if (!groupedData[std.unit]) {
                groupedData[std.unit] = { unit: std.unit, standards: [] };
            }
            groupedData[std.unit].standards.push(std);
        });

        // 단원명 순서, 그리고 성취기준 코드(id) 순으로 예쁘게 정렬합니다.
        const filteredData = Object.values(groupedData).sort((a, b) => a.unit.localeCompare(b.unit));
        filteredData.forEach(group => {
            group.standards.sort((a, b) => a.standardId.localeCompare(b.standardId));
        });

        // 화면에 HTML 그리기
        let html = '';
        html += filteredData.map(unit => `
            <div class="unit-section" style="margin-bottom: 2.5rem;">
                <h3 style="font-size: 1.75rem; font-weight: 850; margin-bottom: 1.5rem; color: var(--text-main); border-bottom: 2px solid var(--border-color, #e2e8f0); padding-bottom: 0.5rem;">
                    ${unit.unit}
                </h3>
                <div class="standards-list" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${unit.standards.map(s => `
                        <div class="standard-row" data-id="${s.standardId}" style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.3s;">
                            
                            <div class="std-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleAccordion(this)">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold; white-space: nowrap; flex-shrink: 0; width: 140px; text-align: center;">${s.standardId}</div>
                                    <div class="std-info"><h4 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${s.description}</h4></div>
                                </div>
                                <div style="color: #2563eb; font-weight: bold; font-size: 1.2rem;">▼</div>
                            </div>
                            
                            <div class="std-levels" style="display: none; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #e2e8f0;">
                                ${Object.entries(s.levels).sort((a, b) => a[0].localeCompare(b[0])).map(([level, desc]) => `
                                    <div class="level-card" style="padding: 1.2rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.2s;" onclick="showDiagnosticQuestion('${s.standardId}', '${level}')" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e2e8f0'">
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
        
        container.innerHTML = html;
    } catch (error) {
        console.error("화면 그리기 실패:", error);
        container.innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
    }
}

// [새로 추가할 코드] 드롭다운 메뉴를 클릭했을 때 화면을 다시 그려주는 기능
document.addEventListener('DOMContentLoaded', () => {
    const courseSelect = document.getElementById('course-select');
    if (courseSelect) {
        courseSelect.addEventListener('change', (e) => {
            // 사용자가 선택한 과목(e.target.value)을 넘겨주며 화면 다시 그리기
            renderAchievementDashboard(e.target.value);
        });
    }
});

window.toggleAccordion = function(element) {
    const row = element.closest('.standard-row');
    const levelsDiv = row.querySelector('.std-levels');
    const isCurrentlyOpen = levelsDiv.style.display === 'block';

    document.querySelectorAll('.std-levels').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.standard-row').forEach(r => r.style.borderColor = '#e2e8f0');

    if (!isCurrentlyOpen) {
        levelsDiv.style.display = 'block';
        row.style.borderColor = '#2563eb'; 
    }
};

// ====================================================================
// [수정] 4. Diagnostic Question (여러 문항 넘겨보기 기능 추가)
// ====================================================================

// 현재 불러온 문항 목록과 인덱스를 기억할 변수
let currentQuestionsList = [];
let currentQuestionIndex = 0;

window.showDiagnosticQuestion = async function(standardId, level) {
    // 로딩 모달을 먼저 띄워줍니다.
    openModal('<div style="text-align:center; padding: 4rem; font-size: 1.2rem;">문항을 불러오는 중입니다... ⏳</div>');

    try {
        // 파이어베이스에서 성취기준 코드와 수준이 일치하는 '모든' 문항을 검색합니다.
        const qRef = collection(db, "questions");
        const qQuery = query(qRef, where("standardId", "==", standardId), where("level", "==", level));
        const querySnapshot = await getDocs(qQuery);

        const templates = [];
        querySnapshot.forEach((doc) => {
            templates.push(doc.data());
        });
        
        if (templates.length === 0) {
            const emptyHtml = `
                <div style="text-align:center; padding: 3rem;">
                    <h3 style="color: #ef4444; margin-bottom: 1rem;">준비된 문항이 없습니다.</h3>
                    <p style="color: #64748b;">[${standardId}]의 [${level}] 수준에 해당하는 판별 문항을 아직 DB에 등록하지 않으셨습니다.</p>
                </div>
            `;
            document.getElementById('modal-body').innerHTML = emptyHtml;
            return;
        }

        // 찾아낸 문항 목록을 변수에 저장하고 첫 번째 문항(index 0)부터 보여줍니다.
        currentQuestionsList = templates;
        currentQuestionIndex = 0;
        
        window.renderCurrentQuestion(standardId, level);

    } catch (error) {
        console.error("문항 불러오기 에러:", error);
        document.getElementById('modal-body').innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">문항을 불러오지 못했습니다.</div>';
    }
};

// 선택된 인덱스의 문항을 화면에 그리는 함수
// 선택된 인덱스의 문항을 화면에 그리는 함수
window.renderCurrentQuestion = function(standardId, level) {
    const q = currentQuestionsList[currentQuestionIndex];
    const totalQuestions = currentQuestionsList.length;

    // 보기(조건) 박스 사이즈 축소
    let conditionsHtml = '';
    if (q.conditions && q.conditions.length > 0) {
        conditionsHtml = `
            <div class="csat-box" style="border: 1px solid #cbd5e1; padding: 0.8rem 1rem; margin: 0.8rem 0; background: #f8fafc; border-radius: 6px;">
                <div style="font-weight: bold; margin-bottom: 0.5rem; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; font-size: 0.9rem;">&lt;보 기&gt;</div>
                ${q.conditions.map(cond => `<div style="margin-bottom: 0.3rem; padding-left: 0.5rem; font-size: 0.9rem;">${cond}</div>`).join('')}
            </div>
        `;
    }

    // 이미지 높이 제한 (스크롤 방지)
    let imageHtml = '';
    if (q.image || q.imageUrl) {
        const imgSrc = q.image || q.imageUrl;
        if (imgSrc.trim().startsWith('<svg')) {
            imageHtml = `<div style="display: flex; justify-content: center; margin-bottom: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0); padding: 0.5rem; background: white; max-height: 250px; overflow: hidden;">${imgSrc}</div>`;
        } else {
            imageHtml = `<img src="${imgSrc}" style="max-height: 250px; width: auto; max-width: 100%; margin-bottom: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0); display: block; margin: 0 auto; object-fit: contain;">`;
        }
    }

    // 다음 버튼 크기 축소
    let nextBtnHtml = '';
    if (totalQuestions > 1) {
        nextBtnHtml = `
            <button onclick="nextQuestion('${standardId}', '${level}')" style="background: #10b981; color: white; border: none; padding: 0.3rem 0.8rem; border-radius: 99px; font-weight: bold; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: 0.2s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                다음 문항 ➡️ (${currentQuestionIndex + 1}/${totalQuestions})
            </button>
        `;
    }

    // 전체 레이아웃 패딩/마진/폰트사이즈 컴팩트하게 조정
    const content = `
        <div class="question-container" style="padding: 0.5rem 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f1f5f9;">
                <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">${standardId}</div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${nextBtnHtml}
                    <div style="font-weight: 800; color: white; background: #f59e0b; padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.85rem;">수준 ${level} 판정</div>
                </div>
            </div>
            
            <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.8rem; line-height: 1.4; color: #0f172a;">${q.question}</h3>
            
            ${imageHtml}
            ${conditionsHtml}

            <div class="options-list" style="display: grid; gap: 0.4rem; margin-top: 0.8rem;">
                ${(q.options || []).map((opt, idx) => `
                    <button class="option-btn" style="text-align: left; padding: 0.6rem 1rem; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; display: flex; align-items: center;" onclick="checkAnswer(this, ${idx}, ${q.answer}, '${(q.levelReason || q.aiReason || '').replace(/'/g, "\\'")}')">
                        <span style="display: inline-block; width: 22px; height: 22px; background: white; border-radius: 50%; text-align: center; line-height: 22px; margin-right: 8px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.1); flex-shrink: 0;">${idx + 1}</span>
                        <span>${opt}</span>
                    </button>
                `).join('')}
            </div>
            
            <div id="feedback-area"></div>
            
            <div id="reason-area" style="display:none; margin-top: 1rem; padding: 1rem; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 0 6px 6px 0;">
                <strong style="color: #2563eb; display: block; margin-bottom: 0.3rem; font-size: 0.9rem;">💡 판정 이유 및 해설</strong>
                <p id="reason-text" style="font-size: 0.85rem; line-height: 1.5; margin: 0; color: #475569; max-height: 120px; overflow-y: auto;"></p>
            </div>
        </div>
    `;
    
    document.getElementById('modal-body').innerHTML = content;
};

// ... 아래 nextQuestion과 checkAnswer 함수는 그대로 유지 ...

// 다음 버튼을 눌렀을 때 실행되는 함수
window.nextQuestion = function(standardId, level) {
    currentQuestionIndex++; // 번호를 1 증가
    // 만약 마지막 문제를 넘어가면 다시 1번 문제로 돌아오도록 처리
    if (currentQuestionIndex >= currentQuestionsList.length) {
        currentQuestionIndex = 0; 
    }
    // 바뀐 번호의 문제를 다시 화면에 그림
    window.renderCurrentQuestion(standardId, level);
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

// 5. Inquiry Logic
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
    container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #64748b;">필수탐구활동 데이터도 데이터베이스로 이전 작업 중입니다. 🚧</div>';
}

// 6. Analysis Logic
function initAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultDiv = document.getElementById('analysis-result');
    
    const btnUploadFile = document.getElementById('btn-upload-file');
    const btnUploadCamera = document.getElementById('btn-upload-camera');
    const fileInput = document.getElementById('file-input');
    const cameraInput = document.getElementById('camera-input');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const btnRemoveImage = document.getElementById('btn-remove-image');
    const uploadButtonsContainer = document.getElementById('upload-buttons-container');

    if (!analyzeBtn) return;

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

    analyzeBtn.addEventListener('click', async () => {
        if (!currentUser) { alert('AI 문항 분석을 사용하려면 구글 로그인을 해주세요.'); return; }
        if (!userApiKey) { document.getElementById('api-modal-overlay').classList.add('active'); return; }
        if (!selectedImageBase64) { alert('분석할 문항 이미지를 업로드하거나 붙여넣기 해주세요.'); return; }

        analyzeBtn.disabled = true;
        analyzeBtn.style.backgroundColor = "#94a3b8";
        analyzeBtn.innerHTML = `⏳ AI가 문항을 분석하고 풀이를 작성 중입니다...`;
        resultDiv.style.display = 'none';

        try {
            const qSnapshot = await getDocs(collection(db, "standards"));
            const allStandards = [];
            qSnapshot.forEach(doc => allStandards.push(doc.data()));
            
            // 💡 [추가] 상세 보기 팝업을 위해 데이터를 전역 변수에 임시 저장합니다.
            window.cachedStandards = allStandards; 

            const curriculumContext = allStandards.map(std => 
                `- 성취기준 코드: ${std.standardId}, 내용: ${std.description}\n` +
                `  [성취수준] A: ${std.levels.A}, B: ${std.levels.B}, C: ${std.levels.C}, D: ${std.levels.D}, E: ${std.levels.E}`
            ).join('\n\n');

            // 💡 [수정] 프롬프트의 HTML 구조에서 성취기준 코드를 '클릭 가능한 버튼' 모양으로 변경했습니다.
            const promptParts = [{
                text: `당신은 대한민국 고등학교 과학 교과 교육과정 및 평가 권위자입니다.
                우선적으로 아래 제공된 [2022 개정 교육과정 통합과학/생명과학 공식 성취기준 데이터]를 확인하세요.

                [공식 성취기준 데이터]
                ${curriculumContext}

                [분석 및 풀이 가이드라인]
                1. 과목 판정 및 성취기준 매칭: 
                   - 위 데이터에서 정확히 일치하는 성취기준 코드를 찾아 매칭하세요.
                2. 성취수준 판정: 해당 문항이 요구하는 사고의 수준을 분석하여 반드시 'A', 'B', 'C', 'D', 'E' 중 하나의 알파벳으로만 판정하세요. (예: B (상 수준) 등 불필요한 수식어 절대 금지. 오직 알파벳 1글자만 출력할 것). 판정 근거를 명확히 제시하세요.
                3. 고도화된 문항 풀이 (단계별 추론 강제):
                   - 처음부터 정답을 말하지 마세요. 반드시 1) 문제의 핵심 조건 분석 → 2) 적용할 심화 과학 원리 도출 → 3) 단계별 논리적 추론 및 계산의 과정을 거쳐 최종 정답을 제시하세요.
                
                결과는 반드시 아래 HTML 구조를 유지하여 반환해주세요.

                <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #bbf7d0;">
                    <p style="margin-bottom: 0.8rem;"><strong>분석 과목 및 단원:</strong> [과목명 및 단원명 기재]</p>
                    <p style="margin-bottom: 0.8rem;"><strong>매칭 성취기준:</strong> <span id="ai-std-result" onclick="showStandardDetails()" style="background: white; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #bbf7d0; cursor: pointer; color: #2563eb; font-weight: bold; text-decoration: underline; transition: 0.2s;" onmouseover="this.style.backgroundColor='#e0e7ff'" onmouseout="this.style.backgroundColor='white'">[성취기준 코드 기재]</span> <span style="font-size: 0.85rem; color: #64748b; margin-left: 5px;">(👆 클릭하여 성취수준 세부내용 확인)</span></p>
                    <p style="margin-bottom: 0;"><strong>판정 성취수준:</strong> <strong style="color: #7c3aed; font-size: 1.1rem;" id="ai-level-result">[A, B, C, D, E 중 택 1]</strong></p>
                </div>
                
                <div style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
                    <strong style="color: #475569; display: block; margin-bottom: 0.5rem;">[⚖️ 교육과정 기반 판정 이유]</strong>
                    <p style="line-height: 1.7; color: #333; margin: 0;">[분석 내용 작성]</p>
                </div>
            
                <div style="background: #eff6ff; padding: 1.5rem; border-radius: 12px; border: 1px solid #bfdbfe;">
                    <strong style="color: #1d4ed8; display: block; margin-bottom: 0.5rem;">[🔬 고도화된 문항 풀이 및 심화 해설]</strong>
                    <p style="line-height: 1.7; color: #333; margin: 0;">[상세 풀이 작성]</p>
                </div>`
            }];

            if (selectedImageBase64) {
                promptParts.push({ inlineData: { mimeType: selectedImageMimeType, data: selectedImageBase64 } });
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${userApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: promptParts }] })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'API 호출 중 오류가 발생했습니다.');

            const aiResultHtml = data.candidates[0].content.parts[0].text;
            resultDiv.style.display = 'block';
            
            resultDiv.innerHTML = `
                <div class="card" style="border: 2px solid #22c55e; background: white; border-radius: 24px; padding: 2.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); margin-top: 2rem;">
                    <h3 style="color: #22c55e; margin-bottom: 1.5rem; font-size: 1.4rem; font-weight: 800;">AI 상세 분석 및 풀이 결과</h3>
                    ${aiResultHtml}
                    
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px dashed #e2e8f0; text-align: center;">
                        <button id="btn-open-save-modal" style="padding: 12px 24px; background: #0f172a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; margin: 0 auto;">
                            💾 분석 결과를 DB에 문항으로 저장하기
                        </button>
                        <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.8rem;">저장된 문항은 나중에 '성취기준 및 수준' 탭에서 랜덤 문항으로 활용됩니다.</p>
                    </div>
                </div>
            `;

            document.getElementById('btn-open-save-modal').addEventListener('click', () => {
                const stdMatch = aiResultHtml.match(/\d{2}[가-힣]+\d*-\d{2}-\d{2}/);
                
                let extractedLevel = "A"; 
                const levelMatchExact = aiResultHtml.match(/id="ai-level-result">([A-E])<\/strong>/);
                const levelMatchText = aiResultHtml.match(/판정\s*성취수준:.*?([A-E])/);
                const levelMatchFallback = aiResultHtml.match(/([A-E])\s*(?:\(상|\(중|\(하|수준)/);

                if (levelMatchExact) {
                    extractedLevel = levelMatchExact[1];
                } else if (levelMatchText) {
                    extractedLevel = levelMatchText[1];
                } else if (levelMatchFallback) {
                    extractedLevel = levelMatchFallback[1];
                }

                document.getElementById('save-std-id').value = stdMatch ? stdMatch[0] : "직접 입력";
                document.getElementById('save-level').value = extractedLevel;
                document.getElementById('save-modal-overlay').classList.add('active');
            });

            const resetBtnContainer = document.getElementById('reset-btn-container');
            const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
            if(resetBtnContainer) resetBtnContainer.style.display = 'block';
            if(chatbotToggleBtn) chatbotToggleBtn.style.display = 'block';
            
            window.lastAnalysisResult = aiResultHtml;
            window.lastAnalyzedImage = selectedImageBase64;
            window.lastAnalyzedImageMime = selectedImageMimeType;

        } catch (error) {
            console.error("❌ 분석 중 에러 발생:", error);
            alert(`분석 실패: ${error.message}`);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.style.backgroundColor = "var(--primary-color)";
            analyzeBtn.textContent = 'AI 문항 분석 시작';
        }
    });
}

// 7. Firebase Auth
function initFirebaseAuth() {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnApiSetup = document.getElementById('btn-api-setup');
    const userNameDisplay = document.getElementById('user-name-display');
    const apiModalOverlay = document.getElementById('api-modal-overlay');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            btnLogin.style.display = 'none';
            userNameDisplay.style.display = 'inline-block';
            userNameDisplay.textContent = `${user.displayName} 선생님`;
            btnLogout.style.display = 'inline-block';
            
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

    btnLogin.addEventListener('click', () => signInWithPopup(auth, provider));
    btnLogout.addEventListener('click', () => signOut(auth));
    
    btnApiSetup.addEventListener('click', () => {
        if (!currentUser) {
            alert("구글 로그인을 먼저 해주세요.");
            return;
        }
        document.getElementById('api-key-input').value = userApiKey; 
        apiModalOverlay.classList.add('active');
    });
    
    document.getElementById('api-modal-close').addEventListener('click', () => apiModalOverlay.classList.remove('active'));

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

// 8. Chatbot Logic
const chatbotPanel = document.getElementById('chatbot-panel');
const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
const chatbotCloseBtn = document.getElementById('chatbot-close-button');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendBtn = document.getElementById('chatbot-send-button');
const chatbotMessages = document.getElementById('chatbot-messages');

function toggleChatbot() {
  chatbotPanel.classList.toggle('chatbot-hidden');
}

chatbotToggleBtn.addEventListener('click', toggleChatbot);
chatbotCloseBtn.addEventListener('click', toggleChatbot);

function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chatbot-message', sender);
  messageDiv.textContent = `${sender === 'user' ? '나: ' : '챗봇: '} ${text}`;
  chatbotMessages.appendChild(messageDiv);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight; 
}

async function sendMessage() {
    const messageText = chatbotInput.value.trim();
    if (!messageText) return;
  
    if (!currentUser || !userApiKey) {
      alert('챗봇 기능을 사용하려면 구글 로그인 및 API Key 설정이 필요합니다.');
      document.getElementById('api-modal-overlay').classList.add('active');
      return;
    }
  
    addMessage(messageText, 'user');
    chatbotInput.value = ''; 
  
    chatbotInput.disabled = true;
    chatbotSendBtn.disabled = true;
    chatbotSendBtn.textContent = '⏳';
    
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.classList.add('chatbot-message', 'bot');
    loadingDiv.innerHTML = `
    <div class="typing-indicator">
      교육과정을 기반으로 답변 작성 중<span></span><span></span><span></span>
    </div>`;
    chatbotMessages.appendChild(loadingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  
    try {
        const curriculumContext = achievementData.map(unit => 
            unit.standards.map(s => `- ${s.id}: ${s.description}`).join('\n')
        ).join('\n');
    
        const promptText = `
      당신은 대한민국 고등학교 과학 교과(통합과학, 물/화/생/지)의 엄격하고 뛰어난 수석 교사이자 평가 전문가입니다.
      
      [참고용 기준 데이터]
      ${curriculumContext}
  
      [현재 분석한 문항 정보]
      사용자는 아래 분석 결과를 얻은 문항과 이미지를 바탕으로 당신에게 질문할 것입니다.
      ${window.lastAnalysisResult || "분석 결과 없음"}
      
      [대화 원칙 - 매우 중요]
      1. 대화의 초점: 오직 방금 분석한 문항과 관련된 과학적 개념, 원리, 풀이 과정에 대해서만 답변하세요. 문항과 전혀 관련 없는 질문(예: 농담, 타 과목 지식, 날씨 등)에는 "해당 질문은 현재 분석 중인 문항과 관련이 없습니다."라며 답변을 정중히 거절하세요.
      2. 확장된 전문성 발휘: 질문한 개념의 숨겨진 과학적 원리, 실생활 연계 예시, 학생들이 자주 헷갈리는 오개념 등 교육적으로 가치 있는 내용을 깊이 있게 덧붙여 설명하세요.
      3. 교육적 원칙 고수: 사용자의 논리나 가정이 틀렸다면 무조건 동조하지 말고, 과학적 사실과 교육과정의 원칙에 근거하여 친절하면서도 단호하게 교정 방향을 제시해 주세요.
      
      질문: "${messageText}"
    `;
    
        const promptParts = [{ text: promptText }];
        if (window.lastAnalyzedImage) {
            promptParts.push({ inlineData: { mimeType: window.lastAnalyzedImageMime, data: window.lastAnalyzedImage } });
        }
  
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${userApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: promptParts }] 
            })
        });
    
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API 통신 오류');
  
        const botReply = data.candidates[0].content.parts[0].text;
  
        document.getElementById(loadingId).remove();
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('chatbot-message', 'bot');
      
        let formattedReply = botReply.replace(/\*\*/g, '').replace(/\n/g, '<br>');
        replyDiv.innerHTML = formattedReply; 
        chatbotMessages.appendChild(replyDiv);
  
    } catch (error) {
      console.error(error);
      document.getElementById(loadingId).remove();
      addMessage(`⚠️ 죄송합니다. 답변을 가져오는 중 오류가 발생했습니다: ${error.message}`, 'bot');
    } finally {
      chatbotInput.disabled = false;
      chatbotSendBtn.disabled = false;
      chatbotSendBtn.textContent = '전송';
      chatbotInput.focus();
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
  }

chatbotSendBtn.addEventListener('click', sendMessage);
chatbotInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// 9. Floating Buttons & Reset
document.getElementById('btn-scroll-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btn-reset-analysis')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const resultDiv = document.getElementById('analysis-result');
    if(resultDiv) resultDiv.style.display = 'none';
    const resetContainer = document.getElementById('reset-btn-container');
    if(resetContainer) resetContainer.style.display = 'none';
    
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
    if(chatbotToggleBtn) chatbotToggleBtn.style.display = 'none';
    const chatbotPanel = document.getElementById('chatbot-panel');
    if(chatbotPanel) chatbotPanel.classList.add('chatbot-hidden');
    
    window.lastAnalysisResult = null;
    window.lastAnalyzedImage = null;
    window.lastAnalyzedImageMime = null;
    
    const removeImgBtn = document.getElementById('btn-remove-image');
    if(removeImgBtn) removeImgBtn.click();
    
    const chatMessages = document.getElementById('chatbot-messages');
    if(chatMessages) {
        chatMessages.innerHTML = `
            <div class="chatbot-message bot" style="background-color: #e0f2fe; border-left: 4px solid #0284c7;">
                <strong style="display:block; margin-bottom:5px; font-size:0.85rem; color:#0369a1;">통합과학 챗봇</strong>
                <div>문항 분석을 진행한 후 저를 호출해 주세요. 분석 결과를 바탕으로 궁금한 점을 답변해 드립니다!</div>
            </div>`;
    }
});

// ====================================================================
// 10. Database Save Logic (서랍 분리 및 연결 구조)
// ====================================================================

// 💡 [추가됨] 화면이 로드될 때 '발문'과 '정답 번호' 입력칸을 강제로 숨김 처리합니다.
document.addEventListener('DOMContentLoaded', () => {
    const qTextInput = document.getElementById('save-question-text');
    const ansInput = document.getElementById('save-correct-answer');
    // 상위 div(라벨 포함)를 찾아서 안 보이게 처리
    if (qTextInput && qTextInput.parentElement) qTextInput.parentElement.style.display = 'none';
    if (ansInput && ansInput.parentElement) ansInput.parentElement.style.display = 'none';
});

document.getElementById('btn-final-db-save')?.addEventListener('click', async () => {
    if (!currentUser) {
        alert("데이터베이스에 저장하려면 구글 로그인이 필요합니다.");
        return;
    }

    const stdId = document.getElementById('save-std-id').value;
    const level = document.getElementById('save-level').value;
    const saveBtn = document.getElementById('btn-final-db-save');

    // 발문 입력 검사 삭제! (이미지 위주이므로 통과시킴)

    saveBtn.textContent = "DB에 저장 중입니다...";
    saveBtn.disabled = true;

    try {
        // 1. 성취기준/성취수준 서랍 (standards 컬렉션)
        const stdDocRef = doc(db, "standards", stdId);
        await setDoc(stdDocRef, {
            standardId: stdId,
            [level]: true, 
            lastUpdatedAt: new Date()
        }, { merge: true });

        // 2. 문항 서랍 (questions 컬렉션)
        await addDoc(collection(db, "questions"), {
            standardId: stdId,
            level: level,
            // 💡 텍스트 칸을 없앴으므로, 기본 안내 문구를 저장합니다. 화면에는 이미지가 예쁘게 뜹니다.
            question: "[AI 분석 문항] 상세 내용은 아래 이미지와 분석/해설을 참고하세요.",
            options: [], // 옵션 버튼 없음
            answer: -1,  // 정답 지정 안함
            imageUrl: window.lastAnalyzedImage ? `data:${window.lastAnalyzedImageMime};base64,${window.lastAnalyzedImage}` : null,
            aiReason: window.lastAnalysisResult,
            createdAt: new Date(),
            authorUid: currentUser.uid
        });
        
        alert("🎉 AI 분석 문항이 성공적으로 저장되었습니다!\n'성취기준 및 수준' 탭에서 확인해 보세요.");
        const saveModalOverlay = document.getElementById('save-modal-overlay');
        if (saveModalOverlay) saveModalOverlay.classList.remove('active');
        
    } catch (error) {
        console.error("DB 저장 에러:", error);
        alert("저장 실패: " + error.message);
    } finally {
        saveBtn.textContent = "데이터베이스에 최종 저장하기";
        saveBtn.disabled = false;
    }
});

// 11. Chatbot Resize
function initChatbotResize() {
    const panel = document.getElementById('chatbot-panel');
    if (!panel) return;

    const directions = ['top', 'left', 'right', 'bottom', 'top-left'];
    
    directions.forEach(dir => {
        const resizer = document.createElement('div');
        resizer.className = `resizer resizer-${dir}`;
        panel.appendChild(resizer);

        resizer.addEventListener('mousedown', initDrag);
        
        function initDrag(e) {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
            const startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);
            
            const startRight = parseInt(document.defaultView.getComputedStyle(panel).right, 10) || 20;
            const startBottom = parseInt(document.defaultView.getComputedStyle(panel).bottom, 10) || 80;

            function doDrag(e) {
                if (dir.includes('left')) {
                    panel.style.width = (startWidth - (e.clientX - startX)) + 'px';
                }
                if (dir.includes('top')) {
                    panel.style.height = (startHeight - (e.clientY - startY)) + 'px';
                }
                if (dir.includes('right')) {
                    panel.style.width = (startWidth + (e.clientX - startX)) + 'px';
                    panel.style.right = (startRight - (e.clientX - startX)) + 'px';
                }
                if (dir.includes('bottom')) {
                    panel.style.height = (startHeight + (e.clientY - startY)) + 'px';
                    panel.style.bottom = (startBottom - (e.clientY - startY)) + 'px';
                }
            }

            function stopDrag() {
                document.documentElement.removeEventListener('mousemove', doDrag);
                document.documentElement.removeEventListener('mouseup', stopDrag);
            }

            document.documentElement.addEventListener('mousemove', doDrag);
            document.documentElement.addEventListener('mouseup', stopDrag);
        }
    });
}


// ====================================================================
// [관리자 전용] 초기 데이터를 독립된 서랍 구조로 Firestore에 일괄 업로드
// ====================================================================
window.uploadInitialDataToFirestore = async function() {
    if (!currentUser) {
        alert("데이터베이스에 쓰기 권한이 필요합니다. 먼저 구글 로그인을 해주세요.");
        return;
    }
    if (!confirm("data.js의 성취기준과 문항 데이터를 데이터베이스에 일괄 업로드하시겠습니까?")) {
        return;
    }

    console.log("🚀 데이터 마이그레이션을 시작합니다...");

    try {
        // 1. 성취기준 서랍 업로드 (standards 컬렉션)
        console.log("1/2: 성취기준(standards) 서랍 업로드 중...");
        for (const unit of achievementData) {
            for (const std of unit.standards) {
                // 문서 이름을 성취기준 코드(예: 10통과1-01-01)로 지정하여 고유하게 관리합니다.
                const stdDocRef = doc(db, "standards", std.id);
                await setDoc(stdDocRef, {
                    course: unit.course,   // 👈 [추가됨] 과목명 (예: "1. 통합과학1")
                    unit: unit.unit,       // 👈 [유지] 중단원명 (예: "(1) 과학의 기초")
                    standardId: std.id,
                    description: std.description,
                    levels: std.levels,
                    lastUpdatedAt: new Date()
                }, { merge: true });
            }
        }

        // 2. 문항 서랍 업로드 (questions 컬렉션)
        console.log("2/2: 문항(questions) 서랍 일괄 업로드 중...");
        let questionCount = 0;
        
        for (const [standardId, levelData] of Object.entries(questionTemplates)) {
            for (const [level, questions] of Object.entries(levelData)) {
                for (const q of questions) {
                    await addDoc(collection(db, "questions"), {
                        standardId: standardId,  
                        level: level,            
                        question: q.question,
                        options: q.options || [],
                        answer: q.answer,
                        conditions: q.conditions || [],
                        image: q.image || null,
                        levelReason: q.levelReason || "",
                        createdAt: new Date(),
                        authorUid: currentUser.uid,
                        isInitialData: true 
                    });
                    questionCount++;
                }
            }
        }

        alert(`🎉 업로드 완료!\n- 성취기준 서랍 세팅 완료\n- 총 ${questionCount}개의 문항이 성공적으로 저장되었습니다.`);
        console.log("✅ 업로드 100% 완료!");

    } catch (error) {
        console.error("데이터 업로드 중 오류 발생:", error);
        alert("업로드 중 오류가 발생했습니다. 브라우저 콘솔 창을 확인해주세요.");
    }
};
// ====================================================================
// 12. 성취기준 상세 보기 팝업 (모달) 기능
// ====================================================================
window.showStandardDetails = function() {
    const stdElement = document.getElementById('ai-std-result');
    if (!stdElement) return;
    
    const stdMatch = stdElement.innerText.match(/\d{2}[가-힣]+\d*-\d{2}-\d{2}/);
    if (!stdMatch) return;
    const stdId = stdMatch[0];

    if (!window.cachedStandards || window.cachedStandards.length === 0) {
        alert("성취기준 데이터를 불러오지 못했습니다.");
        return;
    }
    
    const stdObj = window.cachedStandards.find(s => s.standardId === stdId);
    if (!stdObj) {
        alert(`데이터베이스에서 [${stdId}]에 해당하는 상세 내용을 찾을 수 없습니다.`);
        return;
    }

    // 💡 패딩과 폰트 사이즈를 줄였습니다.
    const levelsHtml = Object.entries(stdObj.levels).sort().map(([lvl, desc]) => {
        let bgColor = '#f8fafc';
        let textColor = '#475569';
        if (lvl === 'A') { bgColor = '#eff6ff'; textColor = '#2563eb'; }
        else if (lvl === 'B') { bgColor = '#f0fdf4'; textColor = '#16a34a'; }
        else if (lvl === 'C') { bgColor = '#fefce8'; textColor = '#d97706'; }
        else if (lvl === 'D') { bgColor = '#fef2f2'; textColor = '#dc2626'; }

        return `
            <div style="padding: 0.8rem; background: ${bgColor}; border-radius: 6px; border: 1px solid #cbd5e1;">
                <strong style="color: ${textColor}; font-size: 0.95rem; margin-bottom: 0.3rem; display: block;">[${lvl} 수준]</strong>
                <span style="color: #333; line-height: 1.4; font-size: 0.85rem;">${desc}</span>
            </div>
        `;
    }).join('');

    const modalContent = `
        <div style="padding: 0.5rem;">
            <h3 style="color: #0f172a; margin-bottom: 0.8rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; font-size: 1.1rem; display: flex; align-items: center;">
                <span style="background: #e0e7ff; color: #2563eb; padding: 0.2rem 0.5rem; border-radius: 6px; margin-right: 8px; font-size: 0.95rem;">${stdObj.standardId}</span>
                <span style="font-weight: 700; font-size: 0.95rem;">상세 루브릭</span>
            </h3>
            <p style="font-weight: 800; font-size: 0.95rem; margin-bottom: 1rem; line-height: 1.4; color: #1e293b;">${stdObj.description}</p>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${levelsHtml}
            </div>
        </div>
    `;
    
    openModal(modalContent);
};