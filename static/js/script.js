// Global variables
let tasks = [];
let currentTaskId = null;

// DOM Elements
const taskForm = document.getElementById('task-form');
const tasksContainer = document.getElementById('tasks-container');
const addTaskModal = document.getElementById('add-task-modal');
const deleteModal = document.getElementById('delete-modal');
const loader = document.getElementById('loader');
const emptyState = document.getElementById('empty-state');
const statusFilter = document.getElementById('status-filter');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');

// DOM Elements - Task Form
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title');
const taskDueDateInput = document.getElementById('task-due-date');
const taskReminderInput = document.getElementById('task-reminder');
const taskStatusInput = document.getElementById('task-status');
const taskPriorityInput = document.getElementById('task-priority');
const statusGroup = document.getElementById('status-group');

// DOM Elements - Dashboard Summary
const pendingCountElement = document.querySelector('#pending-count span');
const inProgressCountElement = document.querySelector('#in-progress-count span');
const completedCountElement = document.querySelector('#completed-count span');
const dueTodayCountElement = document.querySelector('#due-today-count span');

// Initialization function
function init() {
    // Set minimum date for due date input to today
    const today = new Date().toISOString().split('T')[0];
    taskDueDateInput.min = today;
    
    // Load tasks from server
    loadTasks();
    
    // Add event listeners
    setupEventListeners();
}

// Load tasks from the server
function loadTasks() {
    showLoader();
    fetch('/api/tasks')
        .then(response => response.json())
        .then(data => {
            tasksLoaded(data);
        })
        .catch(error => {
            handleError(error);
        });
}

// Handle loaded tasks
function tasksLoaded(data) {
    hideLoader();
    tasks = data;
    renderTasks();
    updateDashboardSummary();
}

// Render tasks based on current filter
function renderTasks() {
    const selectedStatus = statusFilter.value;
    
    // Filter tasks based on selected status
    let filteredTasks = tasks;
    if (selectedStatus !== 'All') {
        filteredTasks = tasks.filter(task => task.Status === selectedStatus);
    }
    
    // Clear tasks container
    tasksContainer.innerHTML = '';
    
    // Show empty state if no tasks
    if (filteredTasks.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    // Hide empty state if tasks exist
    emptyState.classList.add('hidden');
    
    // Sort tasks: Pending and In Progress first, ordered by due date
    filteredTasks.sort((a, b) => {
        // Completed tasks go last
        if (a.Status === 'Completed' && b.Status !== 'Completed') return 1;
        if (a.Status !== 'Completed' && b.Status === 'Completed') return -1;
        
        // Sort by due date (ascending)
        return new Date(a.DueDate) - new Date(b.DueDate);
    });
    
    // Render task cards
    filteredTasks.forEach(renderTaskCard);
}

// Render a single task card
function renderTaskCard(task) {
    const dueDate = new Date(task.DueDate);
    const formattedDueDate = dueDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Check if task is due soon (within next 2 days)
    const today = new Date();
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(today.getDate() + 2);
    
    const isDueSoon = dueDate <= twoDaysFromNow && dueDate >= today && task.Status !== 'Completed';
    const isOverdue = dueDate < today && task.Status !== 'Completed';
    
    const dueDateClass = isOverdue ? 'due-soon' : (isDueSoon ? 'due-soon' : '');
    
    // Create task card element
    const taskCard = document.createElement('div');
    taskCard.className = `task-card status-${task.Status.toLowerCase().replace(' ', '-')}`;
    if (task.Status === 'Completed') {
        taskCard.classList.add('task-status-completed');
    }
    
    taskCard.innerHTML = `
        <div class="task-priority priority-${task.Priority ? task.Priority.toLowerCase() : 'medium'}">
            ${task.Priority || 'Medium'} Priority
        </div>
        <h3 class="task-title">${task.Title}</h3>
        <div class="task-details">
            <div class="task-detail">
                <i class="fas fa-calendar"></i>
                <span class="${dueDateClass}">Due: ${formattedDueDate}</span>
                ${isOverdue ? '<span class="status-badge badge-pending">Overdue</span>' : ''}
            </div>
            <div class="task-detail">
                <i class="fas fa-bell"></i>
                <span>Reminder: ${task.ReminderFrequency}</span>
            </div>
            <div class="task-detail">
                <i class="fas fa-tag"></i>
                <span class="status-badge badge-${task.Status.toLowerCase().replace(' ', '-')}">${task.Status}</span>
            </div>
        </div>
        <div class="task-actions">
            ${task.Status !== 'Completed' ? 
                `<button class="action-btn complete-btn" data-id="${task.TaskID}">
                    <i class="fas fa-check"></i> Complete
                </button>` : ''
            }
            <button class="action-btn edit-btn" data-id="${task.TaskID}">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="action-btn delete-btn" data-id="${task.TaskID}">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    tasksContainer.appendChild(taskCard);
}

// Update dashboard summary data
function updateDashboardSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pendingCount = tasks.filter(task => task.Status === 'Pending').length;
    const inProgressCount = tasks.filter(task => task.Status === 'In Progress').length;
    const completedCount = tasks.filter(task => task.Status === 'Completed').length;
    
    const dueTodayCount = tasks.filter(task => {
        const dueDate = new Date(task.DueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime() && task.Status !== 'Completed';
    }).length;
    
    pendingCountElement.textContent = pendingCount;
    inProgressCountElement.textContent = inProgressCount;
    completedCountElement.textContent = completedCount;
    dueTodayCountElement.textContent = dueTodayCount;
}

// Setup event listeners
function setupEventListeners() {
    // Add task button
    document.getElementById('add-task-btn').addEventListener('click', () => openAddTaskModal());
    
    // Empty state add task button
    document.getElementById('empty-add-task-btn').addEventListener('click', () => openAddTaskModal());
    
    // Save task button
    document.getElementById('save-task-btn').addEventListener('click', saveTask);
    
    // Cancel buttons
    document.getElementById('cancel-btn').addEventListener('click', closeAddTaskModal);
    document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
    
    // Confirm delete button
    document.getElementById('confirm-delete-btn').addEventListener('click', deleteTask);
    
    // Status filter change
    statusFilter.addEventListener('change', renderTasks);
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            if (modalId === 'add-task-modal') {
                closeAddTaskModal();
            } else if (modalId === 'delete-modal') {
                closeDeleteModal();
            }
        });
    });
    
    // Event delegation for task actions
    tasksContainer.addEventListener('click', function(e) {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        
        const taskId = target.dataset.id;
        
        if (target.classList.contains('edit-btn')) {
            openEditTaskModal(taskId);
        } else if (target.classList.contains('delete-btn')) {
            openDeleteModal(taskId);
        } else if (target.classList.contains('complete-btn')) {
            markTaskAsCompleted(taskId);
        }
    });
}

// Open add task modal
function openAddTaskModal() {
    // Reset form
    taskForm.reset();
    taskIdInput.value = '';
    statusGroup.style.display = 'none'; // Hide status field for new tasks
    document.getElementById('modal-title').textContent = 'Add New Task';
    
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    taskDueDateInput.value = tomorrow.toISOString().split('T')[0];
    
    // Set default values
    taskStatusInput.value = 'Pending';
    taskPriorityInput.value = 'Medium';
    
    // Show modal
    addTaskModal.style.display = 'block';
}

// Open edit task modal
function openEditTaskModal(taskId) {
    const task = tasks.find(t => t.TaskID === taskId);
    if (!task) return;
    
    // Set form values
    taskIdInput.value = task.TaskID;
    taskTitleInput.value = task.Title;
    taskDueDateInput.value = task.DueDate;
    taskReminderInput.value = task.ReminderFrequency;
    taskStatusInput.value = task.Status;
    taskPriorityInput.value = task.Priority || 'Medium';
    
    // Show status field for editing
    statusGroup.style.display = 'block';
    
    // Update modal title
    document.getElementById('modal-title').textContent = 'Edit Task';
    
    // Show modal
    addTaskModal.style.display = 'block';
}

// Close add/edit task modal
function closeAddTaskModal() {
    addTaskModal.style.display = 'none';
}

// Open delete confirmation modal
function openDeleteModal(taskId) {
    currentTaskId = taskId;
    deleteModal.style.display = 'block';
}

// Close delete confirmation modal
function closeDeleteModal() {
    deleteModal.style.display = 'none';
    currentTaskId = null;
}

// Save task (add or edit)
function saveTask() {
    // Get form values
    const taskId = taskIdInput.value;
    const title = taskTitleInput.value.trim();
    const dueDate = taskDueDateInput.value;
    const reminderFrequency = taskReminderInput.value;
    const status = taskStatusInput.value;
    const priority = taskPriorityInput.value;
    
    // Validate input
    if (!title) {
        showNotification('Please enter a task title', 'error');
        return;
    }
    
    if (!dueDate) {
        showNotification('Please select a due date', 'error');
        return;
    }
    
    // Prepare task data
    const taskData = {
        Title: title,
        DueDate: dueDate,
        ReminderFrequency: reminderFrequency,
        Status: status,
        Priority: priority
    };
    
    // If taskId exists, it's an edit operation
    if (taskId) {
        taskData.TaskID = taskId;
        
        // Save to server
        showLoader();
        fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        })
        .then(response => response.json())
        .then(data => {
            taskEdited(data);
        })
        .catch(error => {
            handleError(error);
        });
    } else {
        // Save to server
        showLoader();
        fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        })
        .then(response => response.json())
        .then(data => {
            taskAdded(data);
        })
        .catch(error => {
            handleError(error);
        });
    }
    
    // Close modal
    closeAddTaskModal();
}

// Handle task added response
function taskAdded(response) {
    hideLoader();
    if (response.success) {
        showNotification('Task added successfully', 'success');
        loadTasks(); // Reload tasks
    } else {
        showNotification(response.message || 'Failed to add task', 'error');
    }
}

// Handle task edited response
function taskEdited(response) {
    hideLoader();
    if (response.success) {
        showNotification('Task updated successfully', 'success');
        loadTasks(); // Reload tasks
    } else {
        showNotification(response.message || 'Failed to update task', 'error');
    }
}

// Delete task
function deleteTask() {
    if (!currentTaskId) return;
    
    showLoader();
    fetch(`/api/tasks/${currentTaskId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        taskDeleted(data);
    })
    .catch(error => {
        handleError(error);
    });
    
    closeDeleteModal();
}

// Handle task deleted response
function taskDeleted(response) {
    hideLoader();
    if (response.success) {
        showNotification('Task deleted successfully', 'success');
        loadTasks(); // Reload tasks
    } else {
        showNotification(response.message || 'Failed to delete task', 'error');
    }
}

// Mark task as completed
function markTaskAsCompleted(taskId) {
    const task = tasks.find(t => t.TaskID === taskId);
    if (!task) return;
    
    showLoader();
    fetch(`/api/tasks/${taskId}/complete`, {
        method: 'PUT'
    })
    .then(response => response.json())
    .then(data => {
        taskCompleted(data);
    })
    .catch(error => {
        handleError(error);
    });
}

// Handle task completed response
function taskCompleted(response) {
    hideLoader();
    if (response.success) {
        showNotification('Task marked as completed', 'success');
        loadTasks(); // Reload tasks
    } else {
        showNotification(response.message || 'Failed to update task', 'error');
    }
}

// Show notification
function showNotification(message, type) {
    notificationMessage.textContent = message;
    notificationMessage.className = type;
    notification.classList.add('show');
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Show loader
function showLoader() {
    loader.classList.remove('hidden');
}

// Hide loader
function hideLoader() {
    loader.classList.add('hidden');
}

// Handle error
function handleError(error) {
    hideLoader();
    console.error('Error:', error);
    showNotification('An error occurred. Please try again.', 'error');
}

// Initialize app when the page loads
document.addEventListener('DOMContentLoaded', init);