// Firebase Imports
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from './firebase-init.js'; // Import our initialized services

// --- PWA Service Worker Registration ---
// Temporarily disabled. We will re-enable this after the app is fully working.
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('./sw.js')
//             .then(reg => console.log('Service Worker Registered.', reg))
//             .catch(err => console.error('Service Worker registration failed:', err));
//     });
// }

// --- INITIAL DATA & PARSER (FOR FIRST-TIME SETUP) ---
const rawData = `
standardtaskGet chainsaw running1Trevor1hour
standardprojectMaddox Honda 50 rebuild engine2Trevor1day
majortask#figure out suv running boards @4Trevor4hour
standardtaskCreate tv policies at home4Trevor1hour
standardtaskSwitch out battery connector new suv2Trevor1hour
majortaskDrain liquid from dirt bikes3Trevor6hour
standardtaskFixup and/or Move old washer out of Freezer room4Trevor1hour
miniprojectSkirt the house2Trevor6hour
standardprojectGarage Door Opener Fix Electricity (rain/wet issue)2Trevor8hour
miniprojectBuild Bike Holder System in Garage/Quonset (4 bikes desire, 6 if possible)4Trevor6hour
majortaskFishing gear: organize and clean4Trevor4hour
standardtaskSakurs motorcycle: oil change4Trevor2hour
standardtaskMaddox motorcycle: oil change4Trevor2hour
majortaskTry to Repair 18V dewalt batteries4Trevor3hour
miniprojectLiving to Porch Window Decide what to do4Trevor45minutestandardtaskFigure out home firewall issue4Trevor1hour
miniprojectTry to adjust seal or fix it on quonet big doors4Trevor8hour
standardtaskResearch/buy vapor barrier for attic insulation4Trevor1hour
miniprojectRoll out insulation in attic and above kitchen2Trevor6hour
standardtaskGet Bolt Title to Barry1Trevor1hour
majorprojectBuild a Sauna Project4Trevor4day
miniprojectFigure out if Bird Plucker Motor will work.1Trevor6hour
majortaskType up training program for Sakura and Maddox2Trevor3hour
minitaskPut old batteries in bolt1Trevor15minute
standardtaskFind/Repair leak in living room window1Trevor3hour
miniprojectFigure out Gutters1Trevor1day
majorprojectSell YZ1253Trevor4day
majortaskFix Gray Impala Power Steering Pump2Trevor4hour
standardprojectReplace Bedroom Window3Trevor2day
majorprojectDining room Hutch remodel (to wall where wood stove can be)4Trevor15day
majorprojectBasement Poles (get metals ones to raise the floor a bit in spots)2Trevor2day
StandardprojectRoof (Shingles have blown up again…)1Trevor3day
stanadrdtaskShelf in basement (more storage / canning)4Trevor1hour
miniprojectGo through basement Storage3Trevor5hour
standardtaskGet Trevor Clothes out of Laundry Room3Trevor1hour
miniprojectSet up DNS server virtualized so we can use that locally3Trevor4hour
standardtaskFigure out Sakura's flip laptop (the screen flips over and works4Trevor1hour
standardtaskHave chatGPT help me with my LinkedIn profile2Trevor2hour
miniprojectFigure out a Central repository for all the phone pictures and backups2Trevor6hour
majortaskBuild a process for creating characters so Iyoko can do it2Trevor3hour
miniprojectGray as SUV starting issue electrical3Trevor6hour
miniprojectResearch/Setup something like quote IQ for mowing.day4Trevor3hour
majortaskFlow Chart mowing.day setups so far3Trevor3hour
standardtaskDefine Funnels for mowing.day past/future4Trevor2hour
standardtaskAOW Exhibition during duals idea1Trevor2hour
MajortaskDishWasher not Draining Troubleshooting1Trevor4hour
MajortaskFinish acquiring electrical fencing strand4Trevor3hour
standardtaskMake kettlebell holder4Trevor2hour
miniprojectFix Up Boat (make water ready) 3Trevor1day
standardprojectTrailer build 3Trevor2day
MajortaskFix Potholes in Driveway2Trevor4hour
StandardtaskFix Kitchen Door Bottom Hing (holes worn out)2Trevor 2hour
MajortaskFix Red Truck Hitch4Trevor 6hour
MajorProjectBuildout IT Work Scheduling app4Trevor 4dayUsing what I learned from mowing.day about bonnecting bookings app with web app. Possibly a way to align schedule with traveling for either wrestling or whatever and pick up IT Jobs that I can solve in 1-4 hours work for extra money
majortaskReview/update Tasking/Project workflow2Trevor 6hour
majorprojectBuild a butcher room in quonset4Trevor 6day$$$$$
majortaskRed Truck: Fix Brakes (inspect and fix)4Trevor 1day$$
majortaskBuild out kids productivity game (school/Todo/chores/etc.)2Trevor 6hour$
standardprojectFix SUV Sunroof 4Trevor 2day$$
majortaskSet up DNS redudnancy at home4Trevor 4hour
majortaskShower plumbing (sometimes bad smells) troubleshootin / fix3Trevor 6hour$$$
miniprojectSakura Education 5th grade plan buildout2Trevor 1day$
miniprojectMaddox Education 4th grade plan buildout2Trevor 1day$
miniprojectSakura Athletic Program Buildout2Trevor 1day$
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

            tasks.push({
                category,
                subCategory,
                content: match[1].replace(/^:/, '').trim(),
                priority: parseInt(match[2], 10),
                responsible: match[3],
                duration: parseInt(match[4], 10),
                durationUnit: match[5].replace(/s$/, '').toLowerCase(),
                comment: match[6].trim(),
                completed: false,
                createdAt: new Date()
            });
        }
    }
    return tasks;
}


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
async function populateInitialData() {
    console.log('Populating database with initial data...');
    loadingEl.innerText = 'Setting up your list for the first time...';
    const initialTasks = parseInitialData(rawData);
    if (initialTasks.length > 0) {
        const batch = writeBatch(db);
        initialTasks.forEach(task => {
            const newDocRef = doc(tasksCollectionRef);
            batch.set(newDocRef, task);
        });
        await batch.commit();
        console.log('Initial data populated successfully.');
    }
}


async function loadAndDisplayTasks() {
    loadingEl.style.display = 'block';
    
    // Check if the database is empty for this user before setting up the listener
    const initialSnapshot = await getDocs(tasksCollectionRef);
    if (initialSnapshot.empty) {
        await populateInitialData();
    }
    
    unsubscribe(); // Detach any old listener
    
    unsubscribe = onSnapshot(tasksCollectionRef, snapshot => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFilteredAndSortedTasks();

        if (snapshot.metadata.hasPendingWrites) {
             loadingEl.innerText = 'Syncing local changes...';
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
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    initializeAuth();
}

initializeApp();
