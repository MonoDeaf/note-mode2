export class UIManager {
    constructor(taskManager, notificationManager) {
        this.taskManager = taskManager;
        this.notificationManager = notificationManager;
        this.currentPage = 'home';
        this.tasksChart = null;
        this.selectedBackground = null;
        this.charts = null;
        this.globalCharts = null;
        this.isMobileMenuOpen = false;
        this.isLoading = false;
        this.welcomeMessages = [
            "Welcome back, {user}!",
            "What's note-able today, {user}?",
            "Ready to write, {user}?",
            "Hey {user}, let's take some notes!",
            "Great to see you, {user}!",
            "Time to be productive, {user}!",
            "Welcome to your notes, {user}!",
            "Let's capture some thoughts, {user}!",
            "Hi {user}, ready to begin?",
            "Your notes await, {user}!"
        ];

        this.startUpdateCheck();
        this.loadUserSettings();
        this.setupMobileMenu();
        this.setupThemeToggle();
        this.setupHorizontalScroll();
    }

    async initializeUI() {
        this.setupNavigation();
        this.setupEventListeners();
        this.setupGroupModal();
        
        // Load initial data
        if (this.taskManager.currentUser) {
            await this.taskManager.loadUserData();
            this.updateHomePage();
        }
    }

    setupNavigation() {
        const sidebarLinks = document.querySelectorAll('.sidebar a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                
                // Add check for groups page
                if (page === 'groups' && !this.taskManager.currentGroup) {
                    return;
                }
                
                this.navigateTo(page);
            });
        });

        // Add click handlers for group cards
        document.addEventListener('click', (e) => {
            const groupCard = e.target.closest('.group-card:not(.add-group-card)');
            if (groupCard && !e.target.closest('.dot-menu')) {
                const groupId = groupCard.dataset.groupId;
                const group = this.taskManager.groups.get(groupId);
                if (group) {
                    this.taskManager.currentGroup = group;
                    // Enable groups nav link when a group is selected
                    document.querySelector('[data-page="groups"]').classList.add('enabled');
                    this.updateGroupPage(groupId);
                    this.navigateTo('groups');
                }
            }
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const addGroupCard = e.target.closest('#add-group-card');
            if (addGroupCard) {
                const modal = document.getElementById('new-group-modal');
                if (modal) modal.showModal();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.matches('#add-task')) {
                const modal = document.getElementById('new-task-modal');
                if (modal) modal.showModal();
            }

            if (e.target.matches('#mark-all-done')) {
                if (this.taskManager.currentGroup) {
                    this.taskManager.markAllTasksComplete(this.taskManager.currentGroup.id);
                    this.updateGroupPage(this.taskManager.currentGroup.id);
                }
            }
        });

        const cancelTaskBtn = document.getElementById('cancel-task');
        if (cancelTaskBtn) {
            cancelTaskBtn.addEventListener('click', () => {
                const modal = document.getElementById('new-task-modal');
                if (modal) modal.close();
            });
        }

        const dueDateCheckbox = document.getElementById('has-due-date');
        const dueDateInput = document.getElementById('task-due-date');
        const dueDatePresets = document.querySelector('.due-date-presets');
        
        if (dueDateCheckbox && dueDateInput) {
            dueDateCheckbox.addEventListener('change', (e) => {
                dueDateInput.disabled = !e.target.checked;
                dueDateInput.classList.toggle('active', e.target.checked);
                dueDatePresets.classList.toggle('active', e.target.checked);
                if (!e.target.checked) {
                    document.querySelectorAll('.preset-btn').forEach(btn => 
                        btn.classList.remove('selected')
                    );
                }
            });
        }

        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                presetButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                
                const now = new Date();
                let dueDate = new Date();
                
                dueDate.setHours(12, 0, 0, 0);
                
                switch(button.dataset.preset) {
                    case 'today':
                        break;
                    case 'tomorrow':
                        dueDate.setDate(dueDate.getDate() + 1);
                        break;
                    case 'next-week':
                        dueDate.setDate(dueDate.getDate() + 7);
                        break;
                    case 'next-month':
                        dueDate.setMonth(dueDate.getMonth() + 1);
                        break;
                }
                
                const formattedDate = dueDate.toISOString().slice(0, 16);
                dueDateInput.value = formattedDate;
            });
        });

        const newTaskForm = document.querySelector('#new-task-modal form');
        if (newTaskForm) {
            // Remove any existing listeners before adding a new one
            const newForm = newTaskForm.cloneNode(true);
            newTaskForm.parentNode.replaceChild(newForm, newTaskForm);
            
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = document.getElementById('task-title')?.value || '';
                
                if (this.taskManager.currentGroup) {
                    const note = this.taskManager.createNote(
                        this.taskManager.currentGroup.id, 
                        title
                    );
                    if (note) {
                        this.updateGroupPage(this.taskManager.currentGroup.id);
                    }
                }
                
                e.target.reset();
                document.getElementById('new-task-modal')?.close();
            });
        }

        const saveSettingsBtn = document.getElementById('save-settings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                const username = document.getElementById('username')?.value || 'User';
                localStorage.setItem('username', username);
                const welcomeEl = document.getElementById('welcome');
                if (welcomeEl) welcomeEl.textContent = `Welcome, ${username}`;
            });
        }

        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedBackground = {
                    type: 'color',
                    value: option.dataset.color
                };
            });
        });

        const newGroupForm = document.querySelector('#new-group-modal form');
        if (newGroupForm) {
            newGroupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('group-name').value;
                if (name && this.selectedBackground) {
                    const newGroup = this.taskManager.createGroup(name, this.selectedBackground);
                    this.updateHomePage();
                    e.target.reset();
                    document.querySelectorAll('.color-option').forEach(opt => 
                        opt.classList.remove('selected')
                    );
                    document.getElementById('unsplash-images').innerHTML = '';
                    this.selectedBackground = null;
                    document.getElementById('new-group-modal').close();
                }
            });
        }

        const cancelBtn = document.getElementById('cancel-group');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const modal = document.getElementById('new-group-modal');
                const form = modal.querySelector('form');
                if (modal) {
                    modal.close();
                    form.reset();
                    document.querySelectorAll('.color-option, .image-option').forEach(opt => 
                        opt.classList.remove('selected')
                    );
                    this.selectedBackground = null;
                    this.initializeImageGrid();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('#add-group-card')) {
                this.initializeImageGrid(); // Use the stored reference
            }
        });

        // Add calendar navigation handlers
        document.getElementById('prev-month')?.addEventListener('click', () => {
            this.navigateCalendar(-1);
        });
        
        document.getElementById('next-month')?.addEventListener('click', () => {
            this.navigateCalendar(1);
        });
    }

    setupGroupModal() {
        const imageGrid = document.getElementById('unsplash-images');
        
        const initializeImageGrid = () => {
            if (!imageGrid.hasChildNodes()) {
                const imageOptions = [
                    'https://images.unsplash.com/photo-1727466928916-9789f30de10b?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739885507537-ecad018aecb2?q=80&w=1998&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1740568439301-1c1736a8ec69?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1740638733747-a5c2f615e327?q=80&w=2080&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1669295384050-a1d4357bd1d7?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1687392946859-cebb261f01f5?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1650615567023-0721bceeecb6?q=80&w=2127&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1660665416754-e0c780103b3c?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1732032506091-6fd57cc3113e?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1624359136353-f60129a367b9?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1634655377962-e6e7b446e7e9?q=80&w=1964&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1635776062764-e025521e3df3?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1635776062360-af423602aff3?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1639493115942-a51a4c72f3c3?q=80&w=2080&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/flagged/photo-1567934150921-7632371abb32?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1597423244036-ef5020e83f3c?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=2666&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1541512416146-3cf58d6b27cc?q=80&w=2674&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1599054735388-bcb07bdd3574?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1604871082903-5458d164167a?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1627282058750-2b9ce74b6248?q=80&w=2616&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739477021967-e14dc3938e56?q=80&w=2671&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1664309793544-f1d21a3a25d1?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739437455408-66aab68b5c0d?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739367156315-22b8ce82b23b?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1728318781902-dc8f23961e95?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739057736231-3577bfc1a1b9?q=80&w=2650&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739793669691-758d98bd8a4b?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739369122285-8560a5eb18fd?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739732106770-690d3d544bf8?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739359652565-c48db69f62f3?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739113166348-15a660b1cfca?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
                    'https://images.unsplash.com/photo-1739382445469-c35d08ca4277?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3'
                ];

                const imageGridHTML = imageOptions.map(url => `
                    <button type="button" class="image-option" data-url="${url}">
                        <img src="${url}" alt="Background option">
                    </button>
                `).join('');
                
                imageGrid.innerHTML = imageGridHTML;

                const imageButtons = imageGrid.querySelectorAll('.image-option');
                imageButtons.forEach(option => {
                    option.addEventListener('click', () => {
                        imageButtons.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                        this.selectedBackground = {
                            type: 'image',
                            value: option.dataset.url
                        };
                    });
                });
            }
        };

        // Store initializeImageGrid as a property of the class instance
        this.initializeImageGrid = initializeImageGrid;

        initializeImageGrid();

        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedBackground = {
                    type: 'color',
                    value: option.dataset.color
                };
            });
        });

        const modal = document.getElementById('new-group-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.selectedBackground = null;
                document.querySelectorAll('.color-option, .image-option').forEach(opt => 
                    opt.classList.remove('selected')
                );
            }
        });

        const cancelBtn = document.getElementById('cancel-group');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const modal = document.getElementById('new-group-modal');
                const form = modal.querySelector('form');
                if (modal) {
                    modal.close();
                    form.reset();
                    document.querySelectorAll('.color-option, .image-option').forEach(opt => 
                        opt.classList.remove('selected')
                    );
                    this.selectedBackground = null;
                    this.initializeImageGrid(); // Use the stored reference
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('#add-group-card')) {
                this.initializeImageGrid(); // Use the stored reference
            }
        });
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (!menuToggle || !sidebar) {
            console.warn('Mobile menu elements not found');
            return;
        }
        
        const menuIcon = menuToggle.querySelector('img');
        if (!menuIcon) {
            console.warn('Menu icon not found');
            return;
        }

        menuToggle.addEventListener('click', () => {
            this.isMobileMenuOpen = !this.isMobileMenuOpen;
            sidebar.classList.toggle('active', this.isMobileMenuOpen);
            menuToggle.classList.toggle('active', this.isMobileMenuOpen);
            
            menuIcon.src = this.isMobileMenuOpen 
                ? 'https://static-00.iconduck.com/assets.00/sidebar-collapse-icon-512x512-ei3vscn2.png'
                : 'https://static-00.iconduck.com/assets.00/sidebar-expand-icon-512x512-uk1vk52t.png';
        });

        document.addEventListener('click', (e) => {
            if (this.isMobileMenuOpen && 
                !e.target.closest('.sidebar') && 
                !e.target.closest('#menu-toggle')) {
                this.isMobileMenuOpen = false;
                sidebar.classList.remove('active');
                menuToggle.classList.remove('active');
                menuIcon.src = 'https://static-00.iconduck.com/assets.00/sidebar-expand-icon-512x512-uk1vk52t.png';
            }
        });

        const menuItems = sidebar.querySelectorAll('a');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    this.isMobileMenuOpen = false;
                    sidebar.classList.remove('active');
                    menuToggle.classList.remove('active');
                    menuIcon.src = 'https://static-00.iconduck.com/assets.00/sidebar-expand-icon-512x512-uk1vk52t.png';
                }
            });
        });
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', () => {
                document.body.classList.toggle('light-mode', !themeToggle.checked);
                localStorage.setItem('theme', themeToggle.checked ? 'dark' : 'light');
            });
        }
    }

    setupImageGrid(imageGrid) {
        const imageOptions = [
            'https://images.unsplash.com/photo-1727466928916-9789f30de10b?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739885507537-ecad018aecb2?q=80&w=1998&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1740568439301-1c1736a8ec69?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1740638733747-a5c2f615e327?q=80&w=2080&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1669295384050-a1d4357bd1d7?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1687392946859-cebb261f01f5?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1650615567023-0721bceeecb6?q=80&w=2127&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1660665416754-e0c780103b3c?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1732032506091-6fd57cc3113e?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1624359136353-f60129a367b9?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1634655377962-e6e7b446e7e9?q=80&w=1964&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1635776062764-e025521e3df3?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1635776062360-af423602aff3?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1639493115942-a51a4c72f3c3?q=80&w=2080&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/flagged/photo-1567934150921-7632371abb32?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1597423244036-ef5020e83f3c?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=2666&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1541512416146-3cf58d6b27cc?q=80&w=2674&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1599054735388-bcb07bdd3574?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1604871082903-5458d164167a?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1627282058750-2b9ce74b6248?q=80&w=2616&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739477021967-e14dc3938e56?q=80&w=2671&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1664309793544-f1d21a3a25d1?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739437455408-66aab68b5c0d?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739367156315-22b8ce82b23b?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1728318781902-dc8f23961e95?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739057736231-3577bfc1a1b9?q=80&w=2650&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739793669691-758d98bd8a4b?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739369122285-8560a5eb18fd?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739732106770-690d3d544bf8?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739359652565-c48db69f62f3?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739113166348-15a660b1cfca?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
            'https://images.unsplash.com/photo-1739382445469-c35d08ca4277?q=80&w=2787&auto=format&fit=crop&ixlib=rb-4.0.3'
        ];

        const imageGridHTML = imageOptions.map(url => `
            <button type="button" class="image-option" data-url="${url}">
                <img src="${url}" alt="Background option">
            </button>
        `).join('');
        
        imageGrid.innerHTML = imageGridHTML;

        const imageButtons = imageGrid.querySelectorAll('.image-option');
        imageButtons.forEach(option => {
            option.addEventListener('click', () => {
                imageButtons.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedBackground = {
                    type: 'image',
                    value: option.dataset.url
                };
            });
        });
    }

    navigateTo(page) {
        if (page === 'groups' && !this.taskManager.currentGroup) {
            return;
        }

        // Handle note editor closing more gracefully
        const noteEditor = document.querySelector('.note-editor');
        if (noteEditor && noteEditor.classList.contains('active')) {
            // Get current editor content before closing
            const textarea = noteEditor.querySelector('.note-textarea');
            const content = textarea.innerHTML;
            const groupId = noteEditor.dataset.groupId;
            const noteId = noteEditor.dataset.noteId;

            // If there's unsaved content, save it first
            if (groupId && noteId) {
                this.taskManager.saveNoteContent(groupId, noteId, content)
                    .then(() => {
                        // Only after saving, remove the content and close
                        noteEditor.classList.remove('active');
                        setTimeout(() => {
                            textarea.innerHTML = '';
                            noteEditor.dataset.groupId = '';
                            noteEditor.dataset.noteId = '';
                        }, 1200); // Wait for transition to complete
                    });
            }
        }

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');
        
        document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        this.currentPage = page;

        const groupStats = document.getElementById('group-stats');
        if (groupStats) {
            groupStats.style.display = page === 'home' ? 'flex' : 'none';
        }

        if (page === 'home') {
            this.updateHomePage();
        } else if (page === 'graphs') {
            this.updateGraphsPage();
        } else if (page === 'updates') {
            this.updateUpdatesPage();
        } else if (page === 'help') {
            this.updateHelpPage();
        } else if (page === 'tools') {
            this.setupCalendar();
        }
    }

    getContrastColor(background) {
        if (!background) return '#ffffff'; 
        return background.type === 'color' ? '#000000' : '#ffffff';
    }

    setLoading(loading) {
        this.isLoading = loading;
        const groupStats = document.getElementById('group-stats');
        if (groupStats) {
            if (loading) {
                // Insert loading indicator before all other group cards
                const loadingGroups = document.createElement('div');
                loadingGroups.className = 'loading-groups';
                loadingGroups.innerHTML = `
                    <div class="loading-spinner"></div>
                    <p>Loading your groups...</p>
                `;
                groupStats.prepend(loadingGroups);
            } else {
                // Remove loading indicator if exists
                const loadingGroups = groupStats.querySelector('.loading-groups');
                if (loadingGroups) {
                    loadingGroups.remove();
                }
                this.updateHomePage();
            }
        }
    }

    updateHomePage() {
        if (this.isLoading) {
            return;
        }

        // Update welcome message with random greeting
        const welcomeEl = document.getElementById('welcome');
        if (welcomeEl) {
            const username = document.getElementById('username')?.value || 'User';
            const randomMessage = this.welcomeMessages[Math.floor(Math.random() * this.welcomeMessages.length)];
            welcomeEl.textContent = randomMessage.replace('{user}', username);
        }

        const groupStats = document.getElementById('group-stats');
        if (!groupStats) return;
        
        groupStats.innerHTML = '';

        const addGroupCard = document.createElement('div');
        addGroupCard.className = 'group-card add-group-card';
        addGroupCard.id = 'add-group-card';
        addGroupCard.style.animationDelay = '0s';
        addGroupCard.innerHTML = `
            <span class="iconify" data-icon="material-symbols:note-stack-add" width="48" height="48"></span>
            <h3>Create New Group</h3>
        `;
        groupStats.appendChild(addGroupCard);

        if (this.taskManager.groups && this.taskManager.groups.size > 0) {
            // Use the groupOrder array to determine display order
            this.taskManager.groupOrder.forEach((groupId, index) => {
                const group = this.taskManager.groups.get(groupId);
                if (!group) return;
                
                const groupCard = document.createElement('div');
                groupCard.className = 'group-card';
                groupCard.dataset.groupId = group.id;
                // Add animation delay based on index
                groupCard.style.animationDelay = `${(index + 1) * 0.1}s`;
                
                const background = group.background || { type: 'color', value: '#ffffff' };
                const textColor = background.type === 'image' ? '#ffffff' : '#000000';
                
                if (background) {
                    if (background.type === 'color') {
                        groupCard.style.backgroundColor = background.value;
                    } else if (background.type === 'image') {
                        groupCard.style.setProperty('--bg-image', `url(${background.value})`);
                        groupCard.style.backgroundImage = 'none';
                        groupCard.innerHTML = `
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                                       background: rgba(0,0,0,0.3); border-radius: inherit; z-index: 1;"></div>
                        `;
                    }
                }

                const canMoveLeft = this.taskManager.groupOrder.indexOf(group.id) > 0;
                const canMoveRight = this.taskManager.groupOrder.indexOf(group.id) < this.taskManager.groupOrder.length - 1;

                groupCard.innerHTML += `
                    <div class="dot-menu" style="color: ${textColor};">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                        <div class="dot-menu-content">
                            <button class="rename-group" data-group-id="${group.id}">
                                <span class="iconify" data-icon="mdi:pencil-outline"></span>
                                Rename
                            </button>
                            <button class="change-background" data-group-id="${group.id}">
                                <span class="iconify" data-icon="mdi:palette-outline"></span>
                                Change Background
                            </button>
                            ${canMoveLeft ? `
                                <button class="move-left" data-group-id="${group.id}">
                                    <span class="iconify" data-icon="mdi:arrow-left"></span>
                                    Move Left
                                </button>
                            ` : ''}
                            ${canMoveRight ? `
                                <button class="move-right" data-group-id="${group.id}">
                                    <span class="iconify" data-icon="mdi:arrow-right"></span>
                                    Move Right
                                </button>
                            ` : ''}
                            <button class="delete-group" data-group-id="${group.id}">
                                <span class="iconify" data-icon="mdi:delete-outline"></span>
                                Delete Group
                            </button>
                        </div>
                    </div>
                    <div class="corner-arrow">
                        <span class="iconify" data-icon="material-symbols:arrow-outward" width="24" height="24"></span>
                    </div>
                    <div style="position: relative; z-index: 1;">
                        <h3 style="color: ${textColor}; opacity: 1 !important; font-weight: 600;">${group.name}</h3>
                        <p style="color: ${textColor}; opacity: 1 !important;">${group.notes ? group.notes.size : 0} notes</p>
                    </div>
                `;
                
                this.setupGroupCardEventListeners(groupCard, group);
                
                groupStats.appendChild(groupCard);
            });
        }

        groupStats.style.display = 'flex';
    }

    setupGroupCardEventListeners(groupCard, group) {
        const dotMenu = groupCard.querySelector('.dot-menu');
        const dotMenuContent = groupCard.querySelector('.dot-menu-content');
        
        dotMenu?.addEventListener('click', (e) => {
            e.stopPropagation();
            dotMenuContent.classList.toggle('active');
        });

        const renameBtn = groupCard.querySelector('.rename-group');
        renameBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRenameDialog(group.id, group.name);
        });

        const changeBackgroundBtn = groupCard.querySelector('.change-background');
        changeBackgroundBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showChangeBackgroundDialog(group.id);
        });

        const deleteBtn = groupCard.querySelector('.delete-group');
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteConfirmation(group.id);
        });

        const moveLeftBtn = groupCard.querySelector('.move-left');
        moveLeftBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.taskManager.moveGroup(group.id, 'left')) {
                this.updateHomePage();
            }
        });

        const moveRightBtn = groupCard.querySelector('.move-right');
        moveRightBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.taskManager.moveGroup(group.id, 'right')) {
                this.updateHomePage();
            }
        });
    }

    showRenameDialog(groupId, currentName) {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <h3>Rename Group</h3>
            <div class="form-group">
                <input type="text" id="new-group-name" value="${currentName}" placeholder="Enter new name">
            </div>
            <div class="modal-buttons">
                <button class="btn secondary" id="cancel-rename">Cancel</button>
                <button class="btn" id="confirm-rename">Save</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.showModal();

        const input = dialog.querySelector('#new-group-name');
        input.select();

        dialog.querySelector('#cancel-rename').addEventListener('click', () => {
            dialog.close();
            dialog.remove();
        });

        dialog.querySelector('#confirm-rename').addEventListener('click', () => {
            const newName = input.value.trim();
            if (newName) {
                const group = this.taskManager.groups.get(groupId);
                if (group) {
                    group.name = newName;
                    this.taskManager.saveData();
                    this.updateHomePage();
                    if (this.taskManager.currentGroup && this.taskManager.currentGroup.id === groupId) {
                        document.getElementById('group-title').textContent = newName;
                    }
                }
            }
            dialog.close();
            dialog.remove();
        });
    }

    showChangeBackgroundDialog(groupId) {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <form method="dialog">
                <h3>Change Background</h3>
                
                <div class="group-customization">
                    <div class="color-picker">
                        <h4>Choose group color</h4>
                        <div class="color-options">
                            <button type="button" class="color-option" data-color="#FF6B6B" style="background-color: #FF6B6B"></button>
                            <button type="button" class="color-option" data-color="#FFC069" style="background-color: #FFC069"></button>
                            <button type="button" class="color-option" data-color="#4ECDC4" style="background-color: #4ECDC4"></button>
                            <button type="button" class="color-option" data-color="#45B7D1" style="background-color: #45B7D1"></button>
                            <button type="button" class="color-option" data-color="#96CEB4" style="background-color: #96CEB4"></button>
                            <button type="button" class="color-option" data-color="#FFB3B3" style="background-color: #FFB3B3"></button>
                            <button type="button" class="color-option" data-color="#BFACE2" style="background-color: #BFACE2"></button>
                            <button type="button" class="color-option" data-color="#A6D1E6" style="background-color: #A6D1E6"></button>
                            <button type="button" class="color-option" data-color="#FFDEB4" style="background-color: #FFDEB4"></button>
                            <button type="button" class="color-option" data-color="#B5D5C5" style="background-color: #B5D5C5"></button>
                            <button type="button" class="color-option" data-color="#F8C4B4" style="background-color: #F8C4B4"></button>
                            <button type="button" class="color-option" data-color="#E8A0BF" style="background-color: #E8A0BF"></button>
                            <button type="button" class="color-option" data-color="#B4E4FF" style="background-color: #B4E4FF"></button>
                            <button type="button" class="color-option" data-color="#95BDFF" style="background-color: #95BDFF"></button>
                            <button type="button" class="color-option" data-color="#B4CDE6" style="background-color: #B4CDE6"></button>
                            <button type="button" class="color-option" data-color="#FF1E1E" style="background-color: #FF1E1E"></button>
                            <button type="button" class="color-option" data-color="#FF9900" style="background-color: #FF9900"></button>
                            <button type="button" class="color-option" data-color="#FFE600" style="background-color: #FFE600"></button>
                            <button type="button" class="color-option" data-color="#14FF00" style="background-color: #14FF00"></button>
                            <button type="button" class="color-option" data-color="#00FFF0" style="background-color: #00FFF0"></button>
                            <button type="button" class="color-option" data-color="#0066FF" style="background-color: #0066FF"></button>
                            <button type="button" class="color-option" data-color="#9933FF" style="background-color: #9933FF"></button>
                            <button type="button" class="color-option" data-color="#FF00FF" style="background-color: #FF00FF"></button>
                            <button type="button" class="color-option" data-color="#FF0099" style="background-color: #FF0099"></button>
                            <button type="button" class="color-option" data-color="#00FF66" style="background-color: #00FF66"></button>
                            <button type="button" class="color-option" data-color="#ff4a00" style="background-color: #ff4a00"></button>
                            <button type="button" class="color-option" data-color="#d5dcdc" style="background-color: #d5dcdc"></button>
                            <button type="button" class="color-option" data-color="#858585" style="background-color: #858585"></button>
                        </div>
                    </div>

                    <div class="image-picker">
                        <h4>Choose group Image</h4>
                        <div class="image-grid" id="change-background-images"></div>
                    </div>
                </div>

                <div class="modal-buttons">
                    <button type="button" class="btn secondary" id="cancel-background">Cancel</button>
                    <button type="submit" class="btn" id="confirm-background">Save</button>
                </div>
            </form>
        `;
        
        document.body.appendChild(dialog);
        dialog.showModal();

        this.setupImageGrid(dialog.querySelector('#change-background-images'));

        const colorOptions = dialog.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedBackground = {
                    type: 'color',
                    value: option.dataset.color
                };
            });
        });

        dialog.querySelector('#cancel-background').addEventListener('click', () => {
            dialog.close();
            dialog.remove();
        });

        dialog.querySelector('#confirm-background').addEventListener('click', () => {
            if (this.selectedBackground) {
                const group = this.taskManager.groups.get(groupId);
                if (group) {
                    group.background = this.selectedBackground;
                    this.taskManager.saveData();
                    this.updateHomePage();
                }
            }
            dialog.close();
            dialog.remove();
        });
    }

    showDeleteConfirmation(groupId) {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <h3>Delete Group</h3>
            <p>Are you sure you want to delete this group? This action cannot be undone and all notes within the group will be permanently deleted.</p>
            <div class="modal-buttons">
                <button class="btn secondary" id="cancel-delete">Cancel</button>
                <button class="btn danger" id="confirm-delete">Delete</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.showModal();

        dialog.querySelector('#cancel-delete').addEventListener('click', () => {
            dialog.close();
            dialog.remove();
        });

        dialog.querySelector('#confirm-delete').addEventListener('click', () => {
            this.taskManager.deleteGroup(groupId);
            this.updateHomePage();
            dialog.close();
            dialog.remove();
        });
    }

    setupNotesPanel() {
        if (!document.querySelector('.notes-panel')) {
            const notesPanel = document.createElement('div');
            notesPanel.className = 'notes-panel';
            notesPanel.innerHTML = `
                <div class="notes-panel-header">
                    <h3>Task Notes</h3>
                    <button class="close-notes">
                        <span class="iconify" data-icon="mdi:close" width="24" height="24"></span>
                    </button>
                </div>
                <div class="notes-content">
                    <textarea class="notes-textarea" placeholder="Add your notes here..."></textarea>
                    <button class="save-notes">Save Notes</button>
                </div>
            `;
            document.body.appendChild(notesPanel);

            const closeBtn = notesPanel.querySelector('.close-notes');
            closeBtn.addEventListener('click', () => {
                notesPanel.classList.remove('active');
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.notes-panel') && 
                    !e.target.closest('.task-notes-btn')) {
                    notesPanel.classList.remove('active');
                }
            });
        }
    }

    showNotesPanel(groupId, taskId, taskTitle) {
        this.setupNotesPanel();
        const notesPanel = document.querySelector('.notes-panel');
        const textarea = notesPanel.querySelector('.notes-textarea');
        const saveBtn = notesPanel.querySelector('.save-notes');
        const header = notesPanel.querySelector('h3');
        
        header.textContent = taskTitle;
        
        textarea.value = this.taskManager.getTaskNotes(groupId, taskId);
        
        notesPanel.classList.add('active');
        
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        
        notesPanel.querySelector('.save-notes').addEventListener('click', () => {
            this.taskManager.saveTaskNotes(groupId, taskId, textarea.value);
            notesPanel.classList.remove('active');
        });
    }

    updateGroupPage(groupId) {
        const group = this.taskManager.groups.get(groupId);
        if (!group) {
            console.warn(`Group with id ${groupId} not found`);
            return;
        }

        const groupHeader = document.querySelector('.group-header');
        if (!groupHeader) {
            console.warn('Group header element not found');
            return;
        }

        groupHeader.style.backgroundColor = 'var(--bg-secondary)';
        
        const groupTitle = document.getElementById('group-title');
        if (groupTitle) {
            groupTitle.textContent = group.name;
            
            if (group.background) {
                if (group.background.type === 'image') {
                    groupHeader.style.backgroundImage = `url(${group.background.value})`;
                    groupHeader.style.backgroundSize = 'cover';
                    groupHeader.style.backgroundPosition = 'center';
                    groupTitle.style.color = '#ffffff'; // White text for image backgrounds
                } else {
                    groupHeader.style.backgroundColor = group.background.value;
                    groupHeader.style.backgroundImage = 'none';
                    groupTitle.style.color = '#000000'; // Dark text for color backgrounds
                }
            }
        }

        const tasksContainer = document.querySelector('.tasks-container');
        if (!tasksContainer) {
            console.warn('Tasks container element not found');
            return;
        }

        tasksContainer.innerHTML = '';
  
        const tasksListDiv = document.createElement('div');
        tasksListDiv.className = 'tasks-list';
        tasksListDiv.innerHTML = `
            <div class="tasks-header">
                <h3>Notes</h3>
                <div class="tasks-actions">
                    <button id="download-notes" class="btn secondary" title="Download notes as JSON">
                        <span class="iconify" data-icon="mdi:download"></span>
                    </button>
                    <label for="upload-notes" class="btn secondary" title="Upload notes from JSON">
                        <span class="iconify" data-icon="mdi:upload"></span>
                        <input type="file" id="upload-notes" accept=".json" style="display: none;">
                    </label>
                    <button id="add-task" class="btn">Add Note</button>
                </div>
            </div>
            <div class="search-container">
                <input type="text" id="search-notes" placeholder="Search notes...">
                <span class="iconify search-icon" data-icon="mdi:magnify"></span>
            </div>
            <div id="incomplete-tasks"></div>
        `;
        tasksContainer.appendChild(tasksListDiv);

        const searchInput = document.getElementById('search-notes');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterNotes(group, e.target.value.toLowerCase());
            });
        }

        const downloadBtn = document.getElementById('download-notes');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadGroupNotes(group);
            });
        }

        const uploadInput = document.getElementById('upload-notes');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                this.uploadGroupNotes(groupId, e.target.files[0]);
            });
        }

        const incompleteTasks = document.getElementById('incomplete-tasks');
        if (!incompleteTasks) {
            console.warn('Incomplete tasks container not found');
            return;
        }

        incompleteTasks.innerHTML = '';

        if (!group.notes || group.notes.size === 0) {
            incompleteTasks.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: left; padding: 3rem; color: var(--text-secondary);">
                    <svg viewBox="0 0 24 24" width="48" height="48" style="margin-bottom: 0rem; opacity: 0.5;">
                        <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-secondary);">No notes yet</h3>
                    <p style="margin: 0; opacity: 0.7;">Click the "Add Note" button to create your first note</p>
                </div>
            `;
        } else {
            const notesArray = Array.from(group.notes.values())
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            notesArray.forEach(note => {
                if (!note) return;

                const taskElement = document.createElement('div');
                taskElement.className = 'task-item';
                
                const createdDate = new Date(note.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                taskElement.innerHTML = `
                    <div class="task-row">
                        <div class="task-info">
                            <span class="task-title">${note.title}</span>
                            <span class="task-date">${createdDate}</span>
                        </div>
                        <button class="task-edit-btn" data-task-id="${note.id}" title="Edit note title">
                            <span class="iconify" data-icon="mdi:edit-box"></span>
                        </button>
                        <button class="task-delete-btn" data-task-id="${note.id}" title="Delete note">
                            <svg viewBox="0 0 24 24">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                `;

                // Add click handler to show note editor
                taskElement.addEventListener('click', (e) => {
                    // Don't open editor if clicking edit title or delete buttons
                    if (!e.target.closest('.task-edit-btn') && !e.target.closest('.task-delete-btn')) {
                        const noteContent = this.taskManager.getNoteContent(groupId, note.id);
                        this.openNoteEditor(groupId, note.id, note.title, noteContent);
                    }
                });

                // Add event listener for edit button
                const editBtn = taskElement.querySelector('.task-edit-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditTitleDialog(group.id, note.id, note.title);
                });

                const deleteBtn = taskElement.querySelector('.task-delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showDeleteTaskConfirmation(group.id, note.id);
                });

                incompleteTasks.appendChild(taskElement);
            });
        }

        this.updateCharts(groupId);
    }

    filterNotes(group, searchText) {
        const incompleteTasks = document.getElementById('incomplete-tasks');
        incompleteTasks.innerHTML = '';

        if (!group.notes || group.notes.size === 0) {
            incompleteTasks.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: left; padding: 3rem; color: var(--text-secondary);">
                    <svg viewBox="0 0 24 24" width="48" height="48" style="margin-bottom: 0rem; opacity: 0.5;">
                        <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-secondary);">No notes yet</h3>
                    <p style="margin: 0; opacity: 0.7;">Click the "Add Note" button to create your first note</p>
                </div>
            `;
            return;
        }

        const notesArray = Array.from(group.notes.values())
            .filter(note => {
                const titleMatch = note.title.toLowerCase().includes(searchText);
                const notesMatch = (note.notes || '').toLowerCase().includes(searchText);
                return titleMatch || notesMatch;
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (notesArray.length === 0) {
            incompleteTasks.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: left; padding: 3rem; color: var(--text-secondary);">
                    <svg viewBox="0 0 24 24" width="48" height="48" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-secondary);">No matching notes found</h3>
                    <p style="margin: 0; opacity: 0.7;">Try a different search term</p>
                </div>
            `;
            return;
        }
        
        notesArray.forEach(note => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            
            let displayTitle = note.title;
            let matchInfo = '';
            
            if (searchText) {
                if (note.title.toLowerCase().includes(searchText)) {
                    displayTitle = note.title.replace(new RegExp(searchText, 'gi'), match => 
                        `<span class="search-highlight" style="background-color: rgba(var(--text-rgb), 0.2);">${match}</span>`
                    );
                }
                
                if (note.notes && note.notes.toLowerCase().includes(searchText)) {
                    const noteText = note.notes.toString();
                    const searchIndex = noteText.toLowerCase().indexOf(searchText.toLowerCase());
                    const start = Math.max(0, searchIndex - 30);
                    const end = Math.min(noteText.length, searchIndex + 30);
                    let excerpt = noteText.substring(start, end);
                    
                    if (start > 0) excerpt = '...' + excerpt;
                    if (end < noteText.length) excerpt = excerpt + '...';
                    
                    excerpt = excerpt.replace(new RegExp(searchText, 'gi'), match => 
                        `<span class="search-highlight" style="background-color: rgba(var(--text-rgb), 0.2);">${match}</span>`
                    );
                    
                    matchInfo = `
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; 
                                    font-style: italic; opacity: 0.8;">
                            Match found in note: ${excerpt}
                        </div>
                    `;
                }
            }
            
            taskElement.innerHTML = `
                <div class="task-row">
                    <div class="task-info" style="width: 100%;">
                        <div style="display: flex; flex-direction: column;">
                            <span class="task-title">${displayTitle}</span>
                            ${matchInfo}
                        </div>
                        <span class="task-date">${new Date(note.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                    </div>
                    ${!searchText ? `
                    <button class="task-edit-btn" data-task-id="${note.id}" title="Edit note title">
                        <span class="iconify" data-icon="mdi:edit-box"></span>
                    </button>
                    <button class="task-delete-btn" data-task-id="${note.id}" title="Delete note">
                        <svg viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                    ` : ''}
                </div>
            `;

            // Add note click handler
            taskElement.addEventListener('click', (e) => {
                // Don't open editor if clicking edit title or delete buttons
                if (!e.target.closest('.task-edit-btn') && !e.target.closest('.task-delete-btn')) {
                    const noteContent = this.taskManager.getNoteContent(group.id, note.id);
                    this.openNoteEditor(group.id, note.id, note.title, noteContent, searchText);
                }
            });

            // Add edit button handler - but only when not in search mode
            if (!searchText) {
                const editBtn = taskElement.querySelector('.task-edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showEditTitleDialog(group.id, note.id, note.title);
                    });
                }

                // Add delete button handler - but only when not in search mode
                const deleteBtn = taskElement.querySelector('.task-delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showDeleteTaskConfirmation(group.id, note.id);
                    });
                }
            }

            incompleteTasks.appendChild(taskElement);
        });
    }

    openNoteEditor(groupId, taskId, title, content, searchTerm = null) {
        const editor = document.querySelector('.note-editor');
        const headerTitle = editor.querySelector('h3');
        const textarea = editor.querySelector('.note-textarea');
        const doneButton = editor.querySelector('.done-button');
        const closeButton = editor.querySelector('.close-note-editor');
        const textControls = editor.querySelector('.text-controls');
        
        // Remove existing autosave indicator if it exists
        const existingIndicator = editor.querySelector('.autosave-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Remove the done button since we're using autosave
        if (doneButton) {
            doneButton.remove();
        }
        
        // Add autosave indicator next to text controls
        const autosaveIndicator = document.createElement('div');
        autosaveIndicator.className = 'autosave-indicator';
        autosaveIndicator.innerHTML = `
            <span class="iconify" data-icon="mdi:autorenew"></span>
        `;
        textControls.appendChild(autosaveIndicator);

        headerTitle.textContent = title;
        textarea.innerHTML = content;

        // If there's a search term, highlight it and scroll to it
        if (searchTerm) {
            const searchText = searchTerm.toLowerCase();
            const contentHtml = textarea.innerHTML;
            const textContent = textarea.textContent.toLowerCase();
            const searchIndex = textContent.indexOf(searchText);
            
            if (searchIndex !== -1) {
                // Create temporary container to manipulate HTML safely
                const temp = document.createElement('div');
                temp.innerHTML = contentHtml;
                
                // Highlight all instances of the search term
                const highlightedContent = contentHtml.replace(
                    new RegExp(searchTerm, 'gi'),
                    match => `<span class="search-highlight" style="background-color: rgba(var(--text-rgb), 0.3); padding: 2px; border-radius: 2px;">${match}</span>`
                );
                
                textarea.innerHTML = highlightedContent;
                
                // Wait for the editor to be visible before scrolling
                setTimeout(() => {
                    const firstHighlight = textarea.querySelector('.search-highlight');
                    if (firstHighlight) {
                        firstHighlight.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                    }
                }, 300);
            }
        }

        editor.classList.add('active');
        editor.dataset.groupId = groupId;
        editor.dataset.noteId = taskId;

        // Setup text formatting controls
        const textControlBtns = editor.querySelectorAll('.text-control-btn');
        textControlBtns.forEach(btn => {
            // Remove existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const action = newBtn.dataset.action;
                const value = newBtn.dataset.value;
                
                if (action === 'formatBlock') {
                    document.execCommand(action, false, value);
                } else {
                    document.execCommand(action, false, null);
                }
                
                // Toggle active state
                newBtn.classList.toggle('active');
            });
        });

        // Setup font controls
        const fontFamilySelect = editor.querySelector('.font-family-select');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                document.execCommand('fontName', false, e.target.value);
            });
        }

        const fontSizeSelect = editor.querySelector('.font-size-select');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                document.execCommand('fontSize', false, e.target.value);
            });
        }

        // Setup color pickers
        const colorPicker = editor.querySelector('.color-picker-input');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                document.execCommand('foreColor', false, e.target.value);
            });
        }

        const defaultColorBtn = editor.querySelector('.default-color-btn');
        if (defaultColorBtn) {
            defaultColorBtn.addEventListener('click', () => {
                document.execCommand('foreColor', false, getComputedStyle(document.body).getPropertyValue('--text-primary'));
            });
        }

        const bgColorPicker = editor.querySelector('.bg-color-picker-input');
        if (bgColorPicker) {
            bgColorPicker.addEventListener('input', (e) => {
                document.execCommand('backColor', false, e.target.value);
            });
        }

        const defaultBgColorBtn = editor.querySelector('.default-bg-color-btn');
        if (defaultBgColorBtn) {
            defaultBgColorBtn.addEventListener('click', () => {
                // Get the computed background color of the note content area
                const noteContentBg = getComputedStyle(textarea).getPropertyValue('background-color');
                document.execCommand('backColor', false, noteContentBg);
            });
        }

        // Remove any existing close button listener
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);

        // Add close button handler
        newCloseButton.addEventListener('click', () => {
            editor.classList.remove('active');
            editor.dataset.groupId = '';
            editor.dataset.noteId = '';
            textarea.innerHTML = '';
        });

        // Remove any existing input listener
        const newTextarea = textarea.cloneNode(true);
        textarea.parentNode.replaceChild(newTextarea, textarea);
        
        let saveTimeout;
        
        // Handle autosave
        const handleAutosave = async () => {
            const currentGroupId = editor.dataset.groupId;
            const currentNoteId = editor.dataset.noteId;
            
            if (currentGroupId && currentNoteId) {
                autosaveIndicator.classList.add('active');
                
                try {
                    await this.taskManager.saveNoteContent(currentGroupId, currentNoteId, newTextarea.innerHTML);
                    
                    // Show brief indicator
                    setTimeout(() => {
                        autosaveIndicator.classList.remove('active');
                    }, 1000);
                    
                } catch (error) {
                    console.error('Autosave failed:', error);
                    autosaveIndicator.classList.add('error');
                    
                    setTimeout(() => {
                        autosaveIndicator.classList.remove('active', 'error');
                    }, 2000);
                }
            }
        };

        newTextarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(handleAutosave, 1000);
        });

        this.setupTagSystem(newTextarea);

        // Add tags panel 
        let tagsPanel = editor.querySelector('.tags-panel');
        if (!tagsPanel) {
          tagsPanel = document.createElement('div');
          tagsPanel.className = 'tags-panel';
          tagsPanel.innerHTML = `
            <div class="tags-header">
              <h4>Tags</h4>
              <button class="tags-panel-close" title="Close tags panel">
                <span class="iconify" data-icon="mdi:close" width="20" height="20"></span>
              </button>
            </div>
            <div class="tags-list"></div>
          `;
          editor.appendChild(tagsPanel);

          // Add close button functionality
          const closeBtn = tagsPanel.querySelector('.tags-panel-close');
          closeBtn.addEventListener('click', () => {
            tagsPanel.classList.remove('active');
            const noteContent = editor.querySelector('.note-content');
            noteContent.classList.remove('tags-visible');
          });

          // Add toggle functionality
          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'toggle-tags-btn';
          toggleBtn.title = 'Toggle tags panel';
          toggleBtn.innerHTML = `<span class="iconify" data-icon="material-symbols:bookmark-star-rounded"></span>`;
          editor.appendChild(toggleBtn);
          
          const noteContent = editor.querySelector('.note-content');
          
          toggleBtn.addEventListener('click', () => {
            const isActive = tagsPanel.classList.toggle('active');
            noteContent.classList.toggle('tags-visible', isActive);
          });
        }
    }

    setupTagSystem(textarea) {
        if (!textarea) return;

        const editor = textarea.closest('.note-editor');
        if (!editor) return;

        // Create tags panel if it doesn't exist
        let tagsPanel = editor.querySelector('.tags-panel');
        if (!tagsPanel) {
            tagsPanel = document.createElement('div');
            tagsPanel.className = 'tags-panel';
            tagsPanel.innerHTML = `
                <div class="tags-header">
                    <h4>Tags</h4>
                    <button class="tags-panel-close" title="Close tags panel">
                        <span class="iconify" data-icon="mdi:close" width="20" height="20"></span>
                    </button>
                </div>
                <div class="tags-list"></div>
            `;
            editor.appendChild(tagsPanel);

            // Add close button functionality
            const closeBtn = tagsPanel.querySelector('.tags-panel-close');
            closeBtn.addEventListener('click', () => {
                tagsPanel.classList.remove('active');
                const noteContent = editor.querySelector('.note-content');
                noteContent.classList.remove('tags-visible');
            });

            // Add toggle functionality for the toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-tags-btn';
            toggleBtn.title = 'Toggle tags panel';
            toggleBtn.innerHTML = `<span class="iconify" data-icon="material-symbols:bookmark-star-rounded"></span>`;
            editor.appendChild(toggleBtn);
            
            const noteContent = editor.querySelector('.note-content');
            
            toggleBtn.addEventListener('click', () => {
                const isActive = tagsPanel.classList.toggle('active');
                noteContent.classList.toggle('tags-visible', isActive);
            });
        }

        // Function to update tags list
        const updateTags = () => {
            if (!textarea || !tagsPanel) return;

            const content = textarea.innerHTML;
            const tagMatches = content.match(/\[(.*?)\]/g) || [];
            const tagsList = tagsPanel.querySelector('.tags-list');
            if (!tagsList) return;
            
            tagsList.innerHTML = tagMatches.map(tag => {
                const tagText = tag.slice(1, -1); // Remove brackets
                return `
                    <div class="tag-item" data-tag="${tagText}">
                        <span class="tag-text">${tagText}</span>
                        <button class="tag-locate" title="Locate in text">
                            <span class="iconify" data-icon="mdi:target"></span>
                        </button>
                    </div>
                `;
            }).join('');

            // Add click handlers for tag location
            tagsList.querySelectorAll('.tag-locate').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tag = btn.parentElement.dataset.tag;
                    const bracketedTag = `[${tag}]`;
                    
                    // Remove any existing highlights
                    textarea.querySelectorAll('.tag-highlight').forEach(el => {
                        const parent = el.parentNode;
                        parent.replaceChild(document.createTextNode(el.textContent), el);
                    });

                    // Find the text node containing the tag
                    const textNodes = [];
                    const walk = document.createTreeWalker(
                        textarea,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );

                    let node;
                    while ((node = walk.nextNode())) {
                        textNodes.push(node);
                    }

                    // Find the node containing the tag
                    for (let node of textNodes) {
                        const text = node.textContent;
                        const tagIndex = text.indexOf(bracketedTag);
                        
                        if (tagIndex !== -1) {
                            // Create wrapper for new highlight
                            const highlightWrapper = document.createElement('span');
                            highlightWrapper.className = 'tag-highlight';
                            
                            // Create a range for the tag text
                            const range = document.createRange();
                            range.setStart(node, tagIndex);
                            range.setEnd(node, tagIndex + bracketedTag.length);
                            
                            const tagContent = range.extractContents();
                            highlightWrapper.appendChild(tagContent);
                            range.insertNode(highlightWrapper);
                            
                            // Scroll the tag into view
                            highlightWrapper.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center' 
                            });
                            break;
                        }
                    }
                });
            });
        };

        // Watch for content changes
        let observer;
        try {
            observer = new MutationObserver(updateTags);
            observer.observe(textarea, {
                childList: true,
                characterData: true,
                subtree: true
            });

            // Initial tags update
            updateTags();
        } catch (error) {
            console.warn('Error setting up tag observer:', error);
        }

        return () => {
            if (observer) observer.disconnect();
        }; // Return cleanup function
    }

    showDeleteTaskConfirmation(groupId, taskId) {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <h3>Delete Note</h3>
            <p>Are you sure you want to delete this note? This action cannot be undone.</p>
            <div class="modal-buttons">
                <button class="btn secondary" id="cancel-delete">Cancel</button>
                <button class="btn danger" id="confirm-delete">Delete</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.showModal();

        dialog.querySelector('#cancel-delete').addEventListener('click', () => {
            dialog.close();
            dialog.remove();
        });

        dialog.querySelector('#confirm-delete').addEventListener('click', () => {
            this.taskManager.deleteNote(groupId, taskId);
            this.updateGroupPage(groupId);
            dialog.close();
            dialog.remove();
        });
    }

    updateCharts(groupId) {
        const stats = this.taskManager.getGroupStats(groupId);
  
        if (this.charts) {
            Object.values(this.charts).forEach(chart => chart.destroy());
        }
  
        this.charts = {};

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-grid';
        chartContainer.innerHTML = `
            <div class="chart-card">
                <h3>Created Notes</h3>
                <canvas id="groupCreatedChart"></canvas>
            </div>
        `;
        document.querySelector('.tasks-container').appendChild(chartContainer);

        const chartConfig = {
            type: 'line',
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        };

        this.charts.created = new Chart('groupCreatedChart', {
            ...chartConfig,
            data: {
                labels: stats.map(stat => stat.date),
                datasets: [{
                    data: stats.map(stat => stat.created),
                    borderColor: '#7289da',
                    backgroundColor: 'rgba(114, 137, 218, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            }
        });

        const editStats = this.taskManager.getGroupEditStats(groupId);
        if (!editStats) return;

        // Add text activity charts
        const textActivityContainer = document.createElement('div');
        textActivityContainer.className = 'chart-grid';
        textActivityContainer.innerHTML = `
            <div class="chart-card">
                <h3>Text Activity Overview</h3>
                <div class="stats-overview">
                    <div class="mini-stat">
                        <span class="stat-label">Total Characters</span>
                        <span class="stat-value">${editStats.totalCharacters.toLocaleString()}</span>
                    </div>
                    <div class="mini-stat">
                        <span class="stat-label">Avg. Characters/Note</span>
                        <span class="stat-value">${editStats.averageCharactersPerNote.toLocaleString()}</span>
                    </div>
                </div>
                <canvas id="textActivityChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Hourly Text Activity</h3>
                <canvas id="hourlyActivityChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Daily Character Distribution</h3>
                <canvas id="dailyCharactersChart"></canvas>
            </div>
        `;

        document.querySelector('.tasks-container').appendChild(textActivityContainer);

        // Text Activity Chart
        this.charts.textActivity = new Chart('textActivityChart', {
            type: 'line',
            data: {
                labels: editStats.editHistory.map(entry => entry.date),
                datasets: [{
                    label: 'Characters Added',
                    data: editStats.editHistory.map(entry => entry.characters),
                    borderColor: '#4ECDC4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => value.toLocaleString()
                        }
                    }
                }
            }
        });

        // Hourly Activity Chart
        this.charts.hourlyActivity = new Chart('hourlyActivityChart', {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    data: editStats.textEditsByHour,
                    backgroundColor: '#45B7D1',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });

        // Daily Characters Chart
        this.charts.dailyCharacters = new Chart('dailyCharactersChart', {
            type: 'bar',
            data: {
                labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    data: editStats.charactersByDay,
                    backgroundColor: '#96CEB4',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => value.toLocaleString()
                        }
                    }
                }
            }
        });
    }

    updateGraphsPage() {
        const stats = this.taskManager.getTotalStats();
        
        document.getElementById('total-tasks').textContent = stats.total;
        document.getElementById('most-active-day').textContent = stats.mostActiveDay;
        document.getElementById('peak-activity-time').textContent = stats.peakActivityTime;
        document.getElementById('longest-streak').textContent = `${stats.longestStreak} days`;

        if (this.globalCharts) {
            Object.values(this.globalCharts).forEach(chart => chart.destroy());
        }
        
        this.globalCharts = {};

        const defaultRange = 7;
        const weekStats = this.taskManager.getAllNoteStatsForRange(defaultRange);
        
        // Create and update charts with range selector
        this.createRangeSelectableChart('allTasksChart', weekStats, 'Total Notes');
        this.createRangeSelectableChart('creationTrendChart', weekStats, 'Created Notes');

        // Create the other charts as before
        this.globalCharts.activityHeat = new Chart('activityHeatChart', {
            type: 'bar',
            data: {
                labels: Array.from({length: 8}, (_, i) => `${i * 3}:00`),
                datasets: [{
                    data: stats.hourlyActivity,
                    backgroundColor: Array(8).fill('#7289da'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            callback: value => Math.round(value)
                        }
                    }
                }
            }
        });

        this.globalCharts.weekdayActivity = new Chart('weekdayActivityChart', {
            type: 'bar',
            data: {
                labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    data: stats.weekdayActivity,
                    backgroundColor: Array(7).fill('#7289da'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            callback: value => Math.round(value)
                        }
                    }
                }
            }
        });
    }

    createRangeSelectableChart(chartId, initialData, title) {
        const chartContainer = document.getElementById(chartId).parentElement;
        
        // Add range selector in header
        const header = chartContainer.querySelector('h3');
        const chartHeader = document.createElement('div');
        chartHeader.className = 'chart-header';
        header.parentNode.insertBefore(chartHeader, header);
        chartHeader.appendChild(header);
        
        const rangeSelect = document.createElement('select');
        rangeSelect.className = 'range-select';
        rangeSelect.innerHTML = `
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
        `;
        chartHeader.appendChild(rangeSelect);

        // Create initial chart
        this.globalCharts[chartId] = new Chart(chartId, {
            type: chartId === 'creationTrendChart' ? 'bar' : 'line',
            data: {
                labels: initialData.map(stat => stat.date),
                datasets: [{
                    data: chartId === 'creationTrendChart' ? 
                        initialData.map(stat => stat.created) :
                        initialData.map(stat => stat.total),
                    borderColor: '#7289da',
                    backgroundColor: chartId === 'creationTrendChart' ? 
                        '#43b581' :
                        'rgba(114, 137, 218, 0.2)',
                    tension: 0.4,
                    fill: chartId !== 'creationTrendChart',
                    borderRadius: chartId === 'creationTrendChart' ? 4 : 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });

        // Add range change handler
        rangeSelect.addEventListener('change', (e) => {
            const days = parseInt(e.target.value);
            const newData = this.taskManager.getAllNoteStatsForRange(days);
            
            this.globalCharts[chartId].data.labels = newData.map(stat => stat.date);
            this.globalCharts[chartId].data.datasets[0].data = 
                chartId === 'creationTrendChart' ? 
                    newData.map(stat => stat.created) :
                    newData.map(stat => stat.total);
            
            this.globalCharts[chartId].update();
        });
    }

    updateUpdatesPage() {
        import('./updates.js').then(({ updates, setLastSeenVersion, getLatestVersion }) => {
            const updatesContainer = document.querySelector('.updates-container');
            if (!updatesContainer) return;

            updatesContainer.innerHTML = updates.map(update => `
                <div class="update-card">
                    <div class="version">Version ${update.version}</div>
                    <h3>${update.title}</h3>
                    
                    ${update.personalMessage ? `
                        <div class="personal-message">
                            ${update.personalMessage}
                        </div>
                    ` : ''}
                    
                    ${update.updates ? `
                        <div class="update-section updates">
                            <h4>What's New</h4>
                            <ul>
                                ${update.updates.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${update.knownIssues ? `
                        <div class="update-section known-issues">
                            <h4>Known Issues</h4>
                            <ul>
                                ${update.knownIssues.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${update.fixes ? `
                        <div class="update-section fixes">
                            <h4>Fixed Issues</h4>
                            <ul>
                                ${update.fixes.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `).join('');

            setLastSeenVersion(getLatestVersion());
            
            const indicator = document.querySelector('.update-indicator');
            if (indicator) {
                indicator.classList.remove('active');
            }
        });
    }

    loadUserSettings() {
        if (this.currentUser) {
            const userRef = window.ref(this.database, `users/${this.currentUser.uid}`);
            window.onValue(userRef, (snapshot) => {
                const data = snapshot.val() || {};
                const theme = data.theme || 'dark';
                
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) {
                    themeToggle.checked = theme === 'dark';
                    document.body.classList.toggle('light-mode', theme === 'light');
                }

                import('./updates.js').then(({ getLatestVersion }) => {
                    const versionElement = document.getElementById('app-version');
                    if (versionElement) {
                        versionElement.textContent = getLatestVersion();
                    }
                });
            });
        }
    }

    getRelativeDateDisplay(dateStr) {
        const dueDate = new Date(dateStr);
        const today = new Date();
        
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        if (dueDate.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (dueDate.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else if (dueDate > today && dueDate <= nextWeek) {
            return 'Next Week';
        } else if (dueDate > today && dueDate <= nextMonth) {
            return 'Next Month';
        }
        
        return new Date(dateStr).toLocaleString();
    }

    updateUpdatesIndicator() {
        import('./updates.js').then(({ hasNewUpdates }) => {
            const updateIcon = document.querySelector('[data-page="updates"]');
            const indicator = updateIcon.querySelector('.update-indicator') || (() => {
                const div = document.createElement('div');
                div.className = 'update-indicator';
                updateIcon.appendChild(div);
                return div;
            })();
            
            indicator.classList.toggle('active', hasNewUpdates());
        });
    }

    startUpdateCheck() {
        this.updateUpdatesIndicator();
        
        setInterval(() => {
            this.updateUpdatesIndicator();
        }, 30 * 60 * 1000);
    }

    uploadGroupNotes(groupId, file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.notes || !Array.isArray(data.notes)) {
                    throw new Error('Invalid file format');
                }

                data.notes.forEach(note => {
                    const newNote = this.taskManager.createNote(
                        groupId,
                        note.title
                    );
                    if (newNote) {
                        this.taskManager.saveNoteContent(
                            groupId,
                            newNote.id,
                            note.notes || ''
                        );
                    }
                });

                this.updateGroupPage(groupId);
                
                const dialog = document.createElement('dialog');
                dialog.className = 'confirmation-dialog';
                dialog.innerHTML = `
                    <h3>Upload Successful</h3>
                    <p>${data.notes.length} notes have been imported successfully.</p>
                    <div class="modal-buttons">
                        <button class="btn" id="ok-button">OK</button>
                    </div>
                `;
                
                document.body.appendChild(dialog);
                dialog.showModal();
                
                dialog.querySelector('#ok-button').onclick = () => {
                    dialog.close();
                    dialog.remove();
                };

            } catch (error) {
                console.error('Error uploading notes:', error);
                const dialog = document.createElement('dialog');
                dialog.className = 'confirmation-dialog';
                dialog.innerHTML = `
                    <h3>Upload Failed</h3>
                    <p>The selected file is not a valid notes backup file.</p>
                    <div class="modal-buttons">
                        <button class="btn danger" id="ok-button">OK</button>
                    </div>
                `;
                
                document.body.appendChild(dialog);
                dialog.showModal();
                
                dialog.querySelector('#ok-button').onclick = () => {
                    dialog.close();
                    dialog.remove();
                };
            }
        };
        reader.readAsText(file);
    }

    downloadGroupNotes(group) {
        const notes = Array.from(group.notes.values()).map(note => ({
            title: note.title,
            notes: note.notes || '',
            createdAt: note.createdAt
        }));

        const groupData = {
            groupName: group.name,
            notes: notes
        };

        const blob = new Blob([JSON.stringify(groupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${group.name.toLowerCase().replace(/\s+/g, '-')}-notes.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async setCurrentUser(user) {
        this.currentUser = user;
        if (user) {
            this.setLoading(true);
            try {
                const userRef = window.ref(window.database, `users/${user.uid}`);
                const snapshot = await window.get(userRef);
                const data = snapshot.val() || {};
                
                // Update username
                if (data.username) {
                    document.getElementById('username').value = data.username;
                    document.getElementById('welcome').textContent = `Welcome, ${data.username}`;
                }
                
                // Update theme
                if (data.theme) {
                    const themeToggle = document.getElementById('theme-toggle');
                    themeToggle.checked = data.theme === 'dark';
                    document.body.classList.toggle('light-mode', data.theme === 'light');
                }

                // Wait for taskManager to load data
                await this.taskManager.loadUserData();
                
                // Update UI with loaded data
                this.setLoading(false);
            } catch (error) {
                console.error('Error loading user data:', error);
                this.setLoading(false);
            }
        }
    }

    showEditTitleDialog(groupId, noteId, currentTitle) {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <h3>Edit Note Title</h3>
            <div class="form-group">
                <input type="text" id="new-note-title" value="${currentTitle}" placeholder="Enter new title">
            </div>
            <div class="modal-buttons">
                <button class="btn secondary" id="cancel-edit">Cancel</button>
                <button class="btn" id="confirm-edit">Save</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.showModal();

        const input = dialog.querySelector('#new-note-title');
        input.select();

        dialog.querySelector('#cancel-edit').addEventListener('click', () => {
            dialog.close();
            dialog.remove();
        });

        dialog.querySelector('#confirm-edit').addEventListener('click', () => {
            const newTitle = input.value.trim();
            if (newTitle) {
                const group = this.taskManager.groups.get(groupId);
                if (group) {
                    const note = group.notes.get(noteId);
                    if (note) {
                        note.title = newTitle;
                        this.taskManager.saveData();
                        this.updateGroupPage(groupId);
                    }
                }
            }
            dialog.close();
            dialog.remove();
        });
    }

    setupHorizontalScroll() {
        const groupGrid = document.querySelector('.group-grid');
        if (!groupGrid) return;

        window.addEventListener('wheel', (e) => {
            if (e.shiftKey) {
                e.preventDefault();
                groupGrid.classList.add('shift-scroll');
                groupGrid.scrollLeft += e.deltaY;
                
                // Remove the class after scrolling stops
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => {
                    groupGrid.classList.remove('shift-scroll');
                }, 150);
            }
        }, { passive: false });
    }

    setupCalendar() {
        if (!window.dayjs) {
            // Load dayjs if it's not already loaded
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/dayjs@1.11.7/dayjs.min.js";
            script.onload = () => {
                this.initializeCalendar();
            };
            document.head.appendChild(script);
        } else {
            this.initializeCalendar();
        }
    }

    initializeCalendar() {
        this.currentCalendarDate = dayjs();
        this.selectedCalendarDate = dayjs();
        this.renderCalendar();
    }

    renderCalendar() {
        const currentMonth = this.currentCalendarDate.format('MMMM YYYY');
        document.getElementById('current-month').textContent = currentMonth;
        
        const calendarDays = document.getElementById('calendar-days');
        calendarDays.innerHTML = '';
        
        // Get start of month and calculate days for previous month's display
        const firstDayOfMonth = this.currentCalendarDate.startOf('month');
        const startDay = firstDayOfMonth.day(); // Day of week (0-6, 0 is Sunday)
        
        // Get prev month days to show
        const prevMonth = this.currentCalendarDate.subtract(1, 'month');
        const daysInPrevMonth = prevMonth.daysInMonth();
        
        // Get current month's days
        const daysInMonth = this.currentCalendarDate.daysInMonth();
        
        // Get note dates for current month (used to mark dates with notes)
        const noteDates = this.getNotesByDate();
        
        // Render previous month's trailing days
        for (let i = startDay - 1; i >= 0; i--) {
            const dayNumber = daysInPrevMonth - i;
            const dateStr = prevMonth.date(dayNumber).format('YYYY-MM-DD');
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.textContent = dayNumber;
            dayDiv.dataset.date = dateStr;
            
            if (noteDates[dateStr]) {
                dayDiv.classList.add('has-notes');
            }
            
            dayDiv.addEventListener('click', () => this.selectCalendarDate(dateStr));
            calendarDays.appendChild(dayDiv);
        }
        
        // Render current month's days
        const today = dayjs().format('YYYY-MM-DD');
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = this.currentCalendarDate.date(i).format('YYYY-MM-DD');
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.textContent = i;
            dayDiv.dataset.date = dateStr;
            
            if (dateStr === today) {
                dayDiv.classList.add('today');
            }
            
            if (dateStr === this.selectedCalendarDate.format('YYYY-MM-DD')) {
                dayDiv.classList.add('selected');
            }
            
            if (noteDates[dateStr]) {
                dayDiv.classList.add('has-notes');
            }
            
            dayDiv.addEventListener('click', () => this.selectCalendarDate(dateStr));
            calendarDays.appendChild(dayDiv);
        }
        
        // Render next month's leading days
        const daysToAdd = 42 - (startDay + daysInMonth); // 42 = 6 rows of 7 days
        const nextMonth = this.currentCalendarDate.add(1, 'month');
        
        for (let i = 1; i <= daysToAdd; i++) {
            const dateStr = nextMonth.date(i).format('YYYY-MM-DD');
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.textContent = i;
            dayDiv.dataset.date = dateStr;
            
            if (noteDates[dateStr]) {
                dayDiv.classList.add('has-notes');
            }
            
            dayDiv.addEventListener('click', () => this.selectCalendarDate(dateStr));
            calendarDays.appendChild(dayDiv);
        }
        
        // Show notes for selected date
        this.showNotesForDate(this.selectedCalendarDate.format('YYYY-MM-DD'));
    }

    navigateCalendar(monthDiff) {
        this.currentCalendarDate = this.currentCalendarDate.add(monthDiff, 'month');
        this.renderCalendar();
    }

    selectCalendarDate(dateStr) {
        // Remove selected class from previously selected day
        const prevSelected = document.querySelector('.calendar-day.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        
        // Add selected class to newly selected day
        const selectedDay = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
        if (selectedDay) {
            selectedDay.classList.add('selected');
        }
        
        this.selectedCalendarDate = dayjs(dateStr);
        this.showNotesForDate(dateStr);
    }

    getNotesByDate() {
        const noteDates = {};
        
        this.taskManager.groups.forEach(group => {
            if (group.notes) {
                group.notes.forEach(note => {
                    const createdDate = dayjs(note.createdAt).format('YYYY-MM-DD');
                    if (!noteDates[createdDate]) {
                        noteDates[createdDate] = [];
                    }
                    noteDates[createdDate].push({
                        id: note.id,
                        groupId: group.id,
                        groupName: group.name,
                        title: note.title,
                        createdAt: note.createdAt
                    });
                });
            }
        });
        
        return noteDates;
    }

    showNotesForDate(dateStr) {
        const selectedDateElement = document.getElementById('selected-date');
        const notesListElement = document.getElementById('date-notes-list');
        
        if (!selectedDateElement || !notesListElement) return;
        
        // Format date display
        const formattedDate = dayjs(dateStr).format('MMMM D, YYYY');
        selectedDateElement.textContent = formattedDate;
        
        // Get notes for selected date
        const noteDates = this.getNotesByDate();
        const notesForDate = noteDates[dateStr] || [];
        
        // Render notes list
        if (notesForDate.length === 0) {
            notesListElement.innerHTML = '<div id="no-notes-message">No notes created on this date</div>';
            return;
        }
        
        notesListElement.innerHTML = '';
        
        notesForDate.forEach(note => {
            const noteTime = dayjs(note.createdAt).format('h:mm A');
            
            const noteItem = document.createElement('div');
            noteItem.className = 'date-note-item';
            noteItem.innerHTML = `
                <div class="date-note-content">
                    <div class="date-note-title">${note.title}</div>
                    <div class="date-note-group">in ${note.groupName}</div>
                </div>
                <div class="date-note-time">${noteTime}</div>
            `;
            
            noteItem.addEventListener('click', () => {
                // Set current group and navigate to it
                const group = this.taskManager.groups.get(note.groupId);
                if (group) {
                    this.taskManager.currentGroup = group;
                    // Enable groups nav link when a group is selected
                    document.querySelector('[data-page="groups"]').classList.add('enabled');
                    this.updateGroupPage(note.groupId);
                    this.navigateTo('groups');
                    
                    // Open the note editor for this note
                    const noteContent = this.taskManager.getNoteContent(note.groupId, note.id);
                    setTimeout(() => {
                        this.openNoteEditor(note.groupId, note.id, note.title, noteContent);
                    }, 100);
                }
            });
            
            notesListElement.appendChild(noteItem);
        });
    }

    updateHelpPage() {
        import('./help.js').then(({ shortcuts, howToUse, More }) => {
            const shortcutGrid = document.querySelector('#help-page .shortcut-grid');
            if (shortcutGrid) {
                shortcutGrid.innerHTML = shortcuts.map(shortcut => `
                    <div class="shortcut-item">
                        <div class="shortcut-keys">
                            ${shortcut.keys.map(key => `<kbd>${key}</kbd>`).join(' + ')}
                        </div>
                        <div class="shortcut-description">
                            ${shortcut.description}
                        </div>
                    </div>
                `).join('');
            }

            const howToGrid = document.querySelector('#help-page .how-to-grid');
            if (howToGrid) {
                howToGrid.innerHTML = howToUse.map(item => `
                    <div class="how-to-item">
                        <div class="how-to-title">
                            ${item.title}
                        </div>
                        <p>${item.description}</p>
                    </div>
                `).join('');
            }

            const moreGrid = document.querySelector('#help-page .more-grid');
            if (moreGrid) {
                moreGrid.innerHTML = More.map(item => `
                    <div class="how-to-item">
                        <div class="how-to-title">
                            ${item.title}
                        </div>
                        <p>${item.description}</p>
                    </div>
                `).join('');
            }
        });
    }
}