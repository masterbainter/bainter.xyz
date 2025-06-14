// Firebase Imports
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase-init.js'; // Import our initialized db service

// --- CONFIGURATION ---
const appId = 'checklist-app-trevor'; // A unique ID for your app
const tasksCollectionRef = collection(db, `artifacts/${appId}/public/data/tasks`);

// --- INITIAL DATA PARSER ---
const rawData = `
standardtaskGet chainsaw running1Trevor1hour
standardprojectMaddox Honda 50 rebuild engine2Trevor1day
majortask#figure out suv running boards @4Trevor4hour
standardtaskCreate tv policies at home4Trevor1hour
// ... (rest of your raw data)
miniprojectMaddox Athletic Program Buildout2Trevor 1day$
`;
function parseInitialData(text) {
    const tasks = [];
    const typeKeywords = ['standardtask', 'standardproject', 'majortask', 'majorproject', 'miniproject', 'minitask', 'stanadrdtask', 'Standardproject', 'Majortask', 'MajorProject'];
    const splitRegex = new RegExp(`(${typeKeywords.join('|')})`, 'gi');
    const correctedText = text.replace(splitRegex, '\n$1').trim();
    const lines = correctedText.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
        const foundType = typeKeywords.find(t => line.toLowerCase().startsWith(t.toLowerCase()));
        if (!foundType) continue;
        const restOfLine = line.substring(foundType.length);
        const match = restOfLine.match(/(.+?)(\d)\s*(Trevor)\s*(\d+)\s*([a-zA-Z]+)(.*)/);
        if (match) {
            const normalizedType = foundType.toLowerCase().replace('stanadrdtask', 'standardtask');
            const category = normalizedType.includes('project') ? 'project' : 'task';
            const subCategory = normalizedType.replace(/project|task/, '');
            tasks.push({ category, subCategory, content: match[1].replace(/^:/, '').trim(), priority: parseInt(match[2], 10), responsible: match[3], duration: parseInt(match[4], 10), durationUnit: match[5].replace(/s$/, '').toLowerCase(), comment: match[6].trim(), completed: false, createdAt: new Date() });
        }
    }
    return tasks;
}

// --- GLOBAL STATE ---
let unsubscribe = () => {}, allTasks = [];

// --- UI ELEMENTS ---
const taskListEl = document.getElementById('taskList'), loadingEl = document.getElementById('loading'), controlsEl = document.getElementById('controls');
const addTaskBtn = document.getElementById('addTaskBtn'), searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect'), filterSelect = document.getElementById('filterSelect'), subCategoryFilter = document.getElementById('subCategoryFilter');
const modal = document.getElementById('taskModal'), modalBackdrop = modal.querySelector('.modal-backdrop'), modalContent = modal.querySelector('.modal-content');
const taskForm = document.getElementById('taskForm'), modalTitle = document.getElementById('modalTitle'), cancelBtn = document.getElementById('cancelBtn');
const themeToggleBtn = document.getElementById('theme-toggle'), themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon'), themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

// --- DATA & RENDERING LOGIC ---
async function populateInitialData() {
    loadingEl.innerText = 'Setting up your list for the first time...';
    const initialTasks = parseInitialData(rawData);
    if (initialTasks.length > 0) {
        const batch = writeBatch(db);
        initialTasks.forEach(task => batch.set(doc(tasksCollectionRef), task));
        await batch.commit();
    }
}

async function loadAndDisplayTasks() {
    loadingEl.style.display = 'block';
    
    const initialSnapshot = await getDocs(tasksCollectionRef);
    if (initialSnapshot.empty) {
        await populateInitialData();
    }
    
    unsubscribe();
    
    unsubscribe = onSnapshot(tasksCollectionRef, snapshot => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFilteredAndSortedTasks();

        if (snapshot.metadata.hasPendingWrites) {
             loadingEl.innerText = 'Syncing...';
             loadingEl.style.display = 'block';
        } else if (snapshot.empty) {
            loadingEl.innerText = 'No tasks found. Add one to get started!';
            loadingEl.style.display = 'block';
        } else {
            loadingEl.style.display = 'none';
        }
        controlsEl.style.display = 'flex';
    }, error => {
        console.error("Error with real-time listener:", error);
        loadingEl.innerText = "Error loading tasks.";
    });
}

function renderFilteredAndSortedTasks() {
    let tasksToRender = [...allTasks];
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        tasksToRender = tasksToRender.filter(task => (task.content && task.content.toLowerCase().includes(searchTerm)) || (task.comment && task.comment.toLowerCase().includes(searchTerm)));
    }
    const filterValue = filterSelect.value;
    if (filterValue !== 'all') {
        tasksToRender = tasksToRender.filter(task => task.category === filterValue);
    }
    const subCategoryValue = subCategoryFilter.value;
    if (subCategoryValue !== 'all') {
        tasksToRender = tasksToRender.filter(task => task.subCategory === subCategoryValue);
    }
    tasksToRender.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        switch (sortSelect.value) {
            case 'priority': return a.priority - b.priority;
            case 'content-asc': return a.content.localeCompare(b.content);
            case 'content-desc': return b.content.localeCompare(a.content);
            default: return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }
    });
    taskListEl.innerHTML = tasksToRender.map(createTaskCardHTML).join('');
}

function createTaskCardHTML(task) {
    const isCompleted = task.completed ? 'completed' : '';
    const isChecked = task.completed ? 'checked' : '';
    const typeColor = task.category === 'project' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200';
    const subCatCap = task.subCategory ? task.subCategory.charAt(0).toUpperCase() + task.subCategory.slice(1) : '';
    const catCap = task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : '';
    const fullTypeLabel = `${subCatCap} ${catCap}`;

    return `
        <div id="task-${task.id}" class="task-card ${isCompleted} bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 flex flex-col">
            <div class="p-4 flex-grow">
                <div class="flex justify-between items-start"><p class="task-content font-bold text-lg text-gray-800 dark:text-gray-100 flex-1 mr-4">${task.content}</p><input type="checkbox" data-id="${task.id}" class="task-checkbox h-6 w-6 rounded border-gray-300" ${isChecked}></div>
                ${task.comment ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">${task.comment}</p>` : ''}
            </div>
            <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg border-t dark:border-gray-700 flex justify-between items-center text-sm">
                <div class="flex items-center gap-4 flex-wrap"><span class="font-semibold text-gray-600 dark:text-gray-300"><i class="fas fa-clock mr-1 text-gray-400"></i>${task.duration} ${task.durationUnit}(s)</span><span class="px-2 py-1 text-xs font-medium rounded-full ${typeColor}">${fullTypeLabel}</span></div>
                <div><button data-id="${task.id}" class="edit-btn text-gray-400 hover:text-blue-500"><i class="fas fa-edit"></i></button><button data-id="${task.id}" class="delete-btn text-gray-400 hover:text-red-500 ml-2"><i class="fas fa-trash"></i></button></div>
            </div>
        </div>`;
}

// --- MODAL & EVENT LISTENER LOGIC ---
function openModal(task = null) {
    taskForm.reset();
    if (task) {
        modalTitle.innerText = "Edit Task";
        document.getElementById('taskId').value = task.id;
        document.getElementById('content').value = task.content;
        document.getElementById('priority').value = task.priority;
        document.getElementById('category').value = task.category;
        document.getElementById('subCategory').value = task.subCategory;
        document.getElementById('duration').value = task.duration;
        document.getElementById('durationUnit').value = task.durationUnit;
        document.getElementById('comment').value = task.comment;
    } else {
        modalTitle.innerText = "Add New Task";
        document.getElementById('taskId').value = '';
    }
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function closeModal() {
    modalBackdrop.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
     setTimeout(() => modal.classList.add('hidden'), 300);
}

searchInput.addEventListener('input', renderFilteredAndSortedTasks);
sortSelect.addEventListener('change', renderFilteredAndSortedTasks);
filterSelect.addEventListener('change', renderFilteredAndSortedTasks);
subCategoryFilter.addEventListener('change', renderFilteredAndSortedTasks);
addTaskBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = e.target.querySelector('#saveBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Saving...';
    const id = document.getElementById('taskId').value;
    const taskData = { content: document.getElementById('content').value, priority: parseInt(document.getElementById('priority').value, 10), category: document.getElementById('category').value, subCategory: document.getElementById('subCategory').value, duration: parseInt(document.getElementById('duration').value, 10), durationUnit: document.getElementById('durationUnit').value, comment: document.getElementById('comment').value, responsible: 'Trevor', };
    try {
        if (id) {
            await updateDoc(doc(tasksCollectionRef, id), taskData);
        } else {
            taskData.completed = false;
            taskData.createdAt = new Date();
            await addDoc(tasksCollectionRef, taskData);
        }
        closeModal();
    } catch (error) {
        console.error("Error saving task: ", error);
        saveBtn.innerHTML = 'Error!';
        saveBtn.classList.add('bg-red-500');
        setTimeout(() => { saveBtn.innerHTML = originalText; saveBtn.classList.remove('bg-red-500'); saveBtn.disabled = false; }, 3000);
    } finally {
         if (!saveBtn.classList.contains('bg-red-500')) { saveBtn.innerHTML = originalText; saveBtn.disabled = false; }
    }
});
taskListEl.addEventListener('click', async (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    const id = card.id.replace('task-','');
    if (e.target.matches('.task-checkbox')) {
        await updateDoc(doc(tasksCollectionRef, id), { completed: e.target.checked });
    }
    if (e.target.closest('.delete-btn')) {
        e.preventDefault();
        if (window.confirm('Are you sure?')) await deleteDoc(doc(tasksCollectionRef, id));
    }
    if (e.target.closest('.edit-btn')) {
        e.preventDefault();
        const taskToEdit = allTasks.find(t => t.id === id);
        if (taskToEdit) openModal(taskToEdit);
    }
});

// --- THEME TOGGLE ---
function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const isDarkMode = document.documentElement.classList.contains('dark');
    themeToggleLightIcon.classList.toggle('hidden', isDarkMode);
    themeToggleDarkIcon.classList.toggle('hidden', !isDarkMode);
}
themeToggleBtn.addEventListener('click', () => {
    const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
});

// --- INITIALIZATION ---
function initializeApp() {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);
    loadAndDisplayTasks();
}

initializeApp();
