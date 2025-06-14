// NOTE: Firebase is now initialized in index.html. 
// This file assumes `app`, `auth`, and `db` are available globally.

// --- GLOBAL VARIABLES ---
let userId;
let tasksCollectionRef;
let unsubscribe = () => {};
let allTasks = [];

// --- UI ELEMENTS ---
const taskListEl = document.getElementById('taskList');
const loadingEl = document.getElementById('loading');
const controlsEl = document.getElementById('controls');
const addTaskBtn = document.getElementById('addTaskBtn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterSelect = document.getElementById('filterSelect');
const subCategoryFilter = document.getElementById('subCategoryFilter');
const modal = document.getElementById('taskModal');
const modalBackdrop = modal.querySelector('.modal-backdrop');
const modalContent = modal.querySelector('.modal-content');
const taskForm = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');
const cancelBtn = document.getElementById('cancelBtn');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');


// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        userId = user.uid;
        tasksCollectionRef = collection(db, `users/${userId}/tasks`);
        loadAndDisplayTasks();
    }
});

async function initializeAuth() {
    try {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Anonymous authentication failed:", error);
        loadingEl.innerText = "Error: Could not authenticate.";
    }
}

// --- DATA HANDLING & RENDERING ---
function loadAndDisplayTasks() {
    loadingEl.style.display = 'block';
    unsubscribe(); // Detach any old listener
    
    unsubscribe = onSnapshot(tasksCollectionRef, snapshot => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFilteredAndSortedTasks();

        if(snapshot.empty) {
            loadingEl.innerText = 'No tasks found. Add one to get started!';
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
        tasksToRender = tasksToRender.filter(task => 
            task.content.toLowerCase().includes(searchTerm) ||
            (task.comment && task.comment.toLowerCase().includes(searchTerm))
        );
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
            default: return 0;
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
        <div id="task-${task.id}" class="task-card ${isCompleted} bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 flex flex-col transition-all duration-300">
            <div class="p-4 flex-grow">
                <div class="flex justify-between items-start">
                   <p class="task-content font-bold text-lg text-gray-800 dark:text-gray-100 flex-1 mr-4">${task.content}</p>
                   <input type="checkbox" data-id="${task.id}" class="task-checkbox h-6 w-6 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer" ${isChecked}>
                </div>
                ${task.comment ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">${task.comment}</p>` : ''}
            </div>
            <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm">
                <div class="flex items-center gap-4 flex-wrap">
                    <span class="font-semibold text-gray-600 dark:text-gray-300">
                        <i class="fas fa-clock mr-1 text-gray-400 dark:text-gray-500"></i>
                        ${task.duration} ${task.durationUnit}(s)
                    </span>
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${typeColor}">${fullTypeLabel}</span>
                </div>
                <div>
                    <button data-id="${task.id}" class="edit-btn text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"><i class="fas fa-edit"></i></button>
                    <button data-id="${task.id}" class="delete-btn text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

// --- MODAL HANDLING ---
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

// --- EVENT LISTENERS ---
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
    const taskData = {
        content: document.getElementById('content').value,
        priority: parseInt(document.getElementById('priority').value, 10),
        category: document.getElementById('category').value,
        subCategory: document.getElementById('subCategory').value,
        duration: parseInt(document.getElementById('duration').value, 10),
        durationUnit: document.getElementById('durationUnit').value,
        comment: document.getElementById('comment').value,
        responsible: 'Trevor',
    };

    try {
        if (id) {
            const docRef = doc(db, `users/${userId}/tasks`, id);
            await updateDoc(docRef, taskData);
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
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.classList.remove('bg-red-500');
            saveBtn.disabled = false;
        }, 3000);
    } finally {
         if (!saveBtn.classList.contains('bg-red-500')) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
});

taskListEl.addEventListener('click', async (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    const id = card.id.replace('task-','');
    
    if (e.target.matches('.task-checkbox')) {
        const docRef = doc(db, `users/${userId}/tasks`, id);
        await updateDoc(docRef, { completed: e.target.checked });
    }
    
    if (e.target.closest('.delete-btn')) {
        e.preventDefault();
        if (window.confirm('Are you sure you want to delete this task?')) {
            const docRef = doc(db, `users/${userId}/tasks`, id);
            await deleteDoc(docRef);
        }
    }

    if (e.target.closest('.edit-btn')) {
        e.preventDefault();
        const taskToEdit = allTasks.find(t => t.id === id);
        if (taskToEdit) openModal(taskToEdit);
    }
});

// --- THEME TOGGLE ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
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
    // Initial theme setup
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    
    // Start authentication
    initializeAuth();
}

initializeApp();
