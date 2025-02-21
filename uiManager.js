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

    this.startUpdateCheck();
    this.loadUserSettings();
    this.setupMobileMenu();
    this.setupThemeToggle();
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
  }

  setupGroupModal() {
    const imageGrid = document.getElementById('unsplash-images');
    
    const initializeImageGrid = () => {
      if (!imageGrid.hasChildNodes()) {
        const imageOptions = [
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

  navigateTo(page) {
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
    }
  }

  getContrastColor(background) {
    if (!background) return '#ffffff'; 
    return background.type === 'image' ? '#ffffff' : '#000000';
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

    const groupStats = document.getElementById('group-stats');
    if (!groupStats) return;
    
    groupStats.innerHTML = '';

    const addGroupCard = document.createElement('div');
    addGroupCard.className = 'group-card add-group-card';
    addGroupCard.id = 'add-group-card';
    addGroupCard.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <h3>Create New Group</h3>
    `;
    groupStats.appendChild(addGroupCard);

    if (this.taskManager.groups && this.taskManager.groups.size > 0) {
      // Use the groupOrder array to determine display order
      this.taskManager.groupOrder.forEach(groupId => {
        const group = this.taskManager.groups.get(groupId);
        if (!group) return;
        
        const groupCard = document.createElement('div');
        groupCard.className = 'group-card';
        groupCard.dataset.groupId = group.id;
        
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

  setupImageGrid(imageGrid) {
    const imageOptions = [
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
    
    if (group.background) {
      if (group.background.type === 'image') {
        groupHeader.style.backgroundImage = `url(${group.background.value})`;
        groupHeader.style.backgroundSize = 'cover';
        groupHeader.style.backgroundPosition = 'center';
      } else {
        groupHeader.style.backgroundColor = group.background.value;
        groupHeader.style.backgroundImage = 'none';
      }
    }

    const groupTitle = document.getElementById('group-title');
    if (groupTitle) {
      groupTitle.textContent = group.name;
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
            <button class="task-delete-btn" data-task-id="${note.id}" title="Delete note">
              <svg viewBox="0 0 24 24">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        `;

        taskElement.addEventListener('click', (e) => {
          if (!e.target.closest('.task-delete-btn')) {
            this.openNoteEditor(group.id, note.id, note.title, note.notes || '');
          }
        });

        const deleteBtn = taskElement.querySelector('.task-delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteTaskConfirmation(group.id, note.id);
          });
        }
        
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
            `<span style="background-color: rgba(var(--text-rgb), 0.2);">${match}</span>`
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
            `<span style="background-color: rgba(var(--text-rgb), 0.2);">${match}</span>`
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
            ${!searchText ? `
              <span class="task-date">${new Date(note.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            ` : ''}
          </div>
          ${!searchText ? `
            <button class="task-delete-btn" data-task-id="${note.id}" title="Delete note">
              <svg viewBox="0 0 24 24">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          ` : ''}
        </div>
      `;

      taskElement.addEventListener('click', (e) => {
        if (!e.target.closest('.task-delete-btn')) {
          this.openNoteEditor(group.id, note.id, note.title, note.notes || '');
        }
      });

      if (!searchText) {
        const deleteBtn = taskElement.querySelector('.task-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showDeleteTaskConfirmation(group.id, note.id);
        });
      }

      incompleteTasks.appendChild(taskElement);
    });
  }

  openNoteEditor(groupId, taskId, title, content) {
    const editor = document.querySelector('.note-editor');
    const headerTitle = editor.querySelector('h3');
    const textarea = editor.querySelector('.note-textarea');
    const doneButton = editor.querySelector('.done-button');
    const textControls = editor.querySelectorAll('.text-control-btn');
    const commandPalette = document.querySelector('.command-palette');
    
    headerTitle.textContent = title;
    textarea.innerHTML = content;
    editor.classList.add('active');
    
    // Store the current note info
    editor.dataset.groupId = groupId;
    editor.dataset.noteId = taskId;

    let currentRange = null;

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.command-palette') && 
          !e.target.closest('.note-textarea') && 
          commandPalette.classList.contains('active')) {
        commandPalette.classList.remove('active');
        const commandSearchInput = commandPalette.querySelector('input');
        if (commandSearchInput) {
          commandSearchInput.value = '';
        }
      }
    });

    const commands = [
      { label: 'Heading 1', action: 'formatBlock', value: 'h1', icon: 'mdi:format-header-1', shortcut: 'h1' },
      { label: 'Heading 2', action: 'formatBlock', value: 'h2', icon: 'mdi:format-header-2', shortcut: 'h2' },
      { label: 'Heading 3', action: 'formatBlock', value: 'h3', icon: 'mdi:format-header-3', shortcut: 'h3' },
      { label: 'Bold Text', action: 'bold', icon: 'mdi:format-bold', shortcut: 'bold' },
      { label: 'Italic Text', action: 'italic', icon: 'mdi:format-italic', shortcut: 'italic' },
      { label: 'Underline Text', action: 'underline', icon: 'mdi:format-underline', shortcut: 'underline' },
      { label: 'Bullet List', action: 'insertUnorderedList', icon: 'mdi:format-list-bulleted', shortcut: 'list' },
      { label: 'Numbered List', action: 'insertOrderedList', icon: 'mdi:format-list-numbered', shortcut: 'numbered' }
    ];

    commands.push(...[
      { 
        label: 'Arimo Font', 
        action: 'fontName', 
        value: 'Arimo',
        icon: 'mdi:format-font',
        shortcut: 'font',
        preview: 'Aa'
      },
      { 
        label: 'Roboto Font', 
        action: 'fontName', 
        value: 'Roboto',
        icon: 'mdi:format-font',
        shortcut: 'font',
        preview: 'Aa'
      },
      { 
        label: 'Open Sans Font', 
        action: 'fontName', 
        value: 'Open Sans',
        icon: 'mdi:format-font',
        shortcut: 'font',
        preview: 'Aa'
      },
      { 
        label: 'Lato Font', 
        action: 'fontName', 
        value: 'Lato',
        icon: 'mdi:format-font',
        shortcut: 'font',
        preview: 'Aa'
      },
      { 
        label: 'Poppins Font', 
        action: 'fontName', 
        value: 'Poppins',
        icon: 'mdi:format-font',
        shortcut: 'font',
        preview: 'Aa'
      },
      { 
        label: 'Montserrat Font', 
        action: 'fontName', 
        value: 'Montserrat',
        icon: 'mdi:format-font',
        shortcut: 'font',
        preview: 'Aa'
      }
    ], [
      { label: 'Small Text', action: 'fontSize', value: '1', icon: 'mdi:format-size', shortcut: 'size' },
      { label: 'Medium Text', action: 'fontSize', value: '2', icon: 'mdi:format-size', shortcut: 'size' },
      { label: 'Large Text', action: 'fontSize', value: '3', icon: 'mdi:format-size', shortcut: 'size' },
      { label: 'Extra Large Text', action: 'fontSize', value: '4', icon: 'mdi:format-size', shortcut: 'size' },
      { label: 'Huge Text', action: 'fontSize', value: '5', icon: 'mdi:format-size', shortcut: 'size' }
    ]);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === '/') {
        e.preventDefault();
        currentRange = window.getSelection().getRangeAt(0);
        const rect = currentRange.getBoundingClientRect();
        
        commandPalette.style.position = 'absolute';
        commandPalette.style.left = `${rect.left}px`;
        commandPalette.style.top = `${rect.bottom + 5}px`;
        
        commandPalette.classList.add('active');
        const searchInput = commandPalette.querySelector('input');
        searchInput.value = '';
        searchInput.focus();
        
        updateCommandList(commands);
      } else if (e.key === 'Escape' && commandPalette.classList.contains('active')) {
        closeCommandPalette();
      }
    });

    const searchInput = commandPalette.querySelector('input');
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation(); 
    });

    commandPalette.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const fontCommands = commands.filter(command => command.action === 'fontName');
    const sizeCommands = commands.filter(command => command.action === 'fontSize');

    const fontFamilySelect = editor.querySelector('.font-family-select');
    const fontSizeSelect = editor.querySelector('.font-size-select');
    const colorPicker = editor.querySelector('.color-picker-input');

    fontFamilySelect.addEventListener('change', () => {
      document.execCommand('fontName', false, fontFamilySelect.value);
      textarea.focus();
    });

    fontSizeSelect.addEventListener('change', () => {
      document.execCommand('fontSize', false, fontSizeSelect.value);
      textarea.focus();
    });

    colorPicker.addEventListener('input', () => {
      document.execCommand('foreColor', false, colorPicker.value);
      textarea.focus();
    });

    textControls.forEach(btn => {
      const action = btn.dataset.action;
      const value = btn.dataset.value;
      
      btn.onclick = () => {
        if (action === 'formatBlock') {
          document.execCommand(action, false, value);
        } else {
          document.execCommand(action, false, null);
        }
        
        // Check state and update active class
        let isActive = false;
        switch(action) {
          case 'bold':
            isActive = document.queryCommandState('bold');
            break;
          case 'italic':
            isActive = document.queryCommandState('italic');
            break;
          case 'underline':
            isActive = document.queryCommandState('underline');
            break;
          case 'insertUnorderedList':
            isActive = document.queryCommandState('insertUnorderedList');
            break;
          case 'insertOrderedList':
            isActive = document.queryCommandState('insertOrderedList');
            break;
          case 'formatBlock':
            isActive = document.queryCommandValue('formatBlock').toLowerCase() === value.toLowerCase();
            break;
        }
        
        btn.classList.toggle('active', isActive);
        textarea.focus();
      };

      // Listen for selection changes to update active states
      textarea.addEventListener('mouseup', () => {
        let isActive = false;
        switch(action) {
          case 'bold':
            isActive = document.queryCommandState('bold');
            break;
          case 'italic':
            isActive = document.queryCommandState('italic');
            break;
          case 'underline':
            isActive = document.queryCommandState('underline');
            break;
          case 'insertUnorderedList':
            isActive = document.queryCommandState('insertUnorderedList');
            break;
          case 'insertOrderedList':
            isActive = document.queryCommandState('insertOrderedList');
            break;
          case 'formatBlock':
            isActive = document.queryCommandValue('formatBlock').toLowerCase() === value.toLowerCase();
            break;
        }
        btn.classList.toggle('active', isActive);
      });

      textarea.addEventListener('keyup', () => {
        let isActive = false;
        switch(action) {
          case 'bold':
            isActive = document.queryCommandState('bold');
            break;
          case 'italic':
            isActive = document.queryCommandState('italic');
            break;
          case 'underline':
            isActive = document.queryCommandState('underline');
            break;
          case 'insertUnorderedList':
            isActive = document.queryCommandState('insertUnorderedList');
            break;
          case 'insertOrderedList':
            isActive = document.queryCommandState('insertOrderedList');
            break;
          case 'formatBlock':
            isActive = document.queryCommandValue('formatBlock').toLowerCase() === value.toLowerCase();
            break;
        }
        btn.classList.toggle('active', isActive);
      });
    });

    doneButton.onclick = () => {
      const currentGroupId = editor.dataset.groupId;
      const currentNoteId = editor.dataset.noteId;
      if (currentGroupId && currentNoteId) {
        this.taskManager.saveNoteContent(currentGroupId, currentNoteId, textarea.innerHTML);
        editor.classList.remove('active');
        this.updateGroupPage(currentGroupId); // Refresh the group page
      }
    };

    const handleClickOutside = (e) => {
      if (!editor.contains(e.target) && !commandPalette.contains(e.target)) {
        editor.classList.remove('active');
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (commandPalette.classList.contains('active')) {
          closeCommandPalette();
        } else {
          editor.classList.remove('active');
          document.removeEventListener('keydown', handleEscape);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);

    function updateCommandList(items) {
      const commandList = commandPalette.querySelector('.command-list');
      commandList.innerHTML = items.map(cmd => {
        let extraClass = '';
        let previewHtml = '';
        
        if (cmd.action === 'fontName') {
          extraClass = 'font-family';
          previewHtml = `<span class="preview" style="font-family: ${cmd.value}">${cmd.preview}</span>`;
        }
        
        return `
          <div class="command-item ${extraClass}" data-action="${cmd.action}" data-value="${cmd.value || ''}">
            <div class="icon">
              <span class="iconify" data-icon="${cmd.icon}"></span>
            </div>
            <span class="label">${cmd.label}</span>
            ${previewHtml}
            <span class="shortcut">${cmd.shortcut}</span>
          </div>
        `;
      }).join('');
    }

    function executeCommand(action, value) {
      if (currentRange) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(currentRange);
      }

      if (action === 'fontName' || action === 'fontSize' || action === 'foreColor') {
        document.execCommand(action, false, value);
      } else if (value) {
        document.execCommand(action, false, value);
      } else {
        document.execCommand(action, false, null);
      }

      closeCommandPalette();
      textarea.focus();
    }

    function closeCommandPalette() {
      commandPalette.classList.remove('active');
      const commandSearchInput = commandPalette.querySelector('input');
      commandSearchInput.value = '';
    }

    const commandSearchInput = commandPalette.querySelector('input');
    commandSearchInput.addEventListener('input', () => {
      const query = commandSearchInput.value.toLowerCase();
      const filteredCommands = commands.filter(cmd => 
        cmd.label.toLowerCase().includes(query) || 
        cmd.shortcut.toLowerCase().includes(query)
      );
      updateCommandList(filteredCommands);
    });

    commandPalette.querySelector('.command-list').addEventListener('click', (e) => {
      const commandItem = e.target.closest('.command-item');
      if (commandItem) {
        e.stopPropagation(); 
        executeCommand(commandItem.dataset.action, commandItem.dataset.value);
      }
    });
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

    const weekStats = this.taskManager.getAllNoteStats();
    
    this.globalCharts.allTasks = new Chart('allTasksChart', {
      type: 'line',
      data: {
        labels: weekStats.map(stat => stat.date),
        datasets: [{
          label: 'Total Tasks',
          data: weekStats.map(stat => stat.total),
          borderColor: '#7289da',
          backgroundColor: 'rgba(114, 137, 218, 0.1)',
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
              stepSize: 1
            }
          }
        }
      }
    });

    this.globalCharts.creationTrend = new Chart('creationTrendChart', {
      type: 'bar',
      data: {
        labels: weekStats.map(stat => stat.date),
        datasets: [{
          data: weekStats.map(stat => stat.created),
          backgroundColor: '#43b581',
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

  updateUpdatesPage() {
    const updatesContainer = document.querySelector('.updates-container');
    if (!updatesContainer) return;

    import('./updates.js').then(({ updates, setLastSeenVersion, getLatestVersion }) => {
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
}