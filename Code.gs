/**
 * TaskMaster - Task Management Application
 * Google Apps Script backend for Google Sheets integration and email reminders
 */

// Configuration
const SHEET_NAME = 'Tasks';
const COLUMNS = {
  TaskID: 0,
  Title: 1,
  DueDate: 2,
  ReminderFrequency: 3,
  Status: 4,
  CreatedAt: 5,
  LastReminderSent: 6,
  Priority: 7
};

/**
 * Triggered when the web app is opened
 * @param {Object} e - Event object
 * @return {HtmlOutput} The HTML content for the web app
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TaskMaster')
    .setFaviconUrl('https://cdn-icons-png.flaticon.com/512/2387/2387635.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include HTML files
 * @param {string} filename - Name of the file to include
 * @return {string} The content of the file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Initialize the spreadsheet
 * Creates the Tasks sheet if it doesn't exist and sets up headers
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    
    // Set up headers
    const headers = [
      'TaskID', 
      'Title', 
      'DueDate', 
      'ReminderFrequency', 
      'Status', 
      'CreatedAt', 
      'LastReminderSent',
      'Priority'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#3498db')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
  }
  
  return sheet;
}

/**
 * Get tasks from the spreadsheet
 * @return {Array} Array of task objects
 */
function getTasks() {
  try {
    const sheet = initializeSpreadsheet();
    const lastRow = Math.max(sheet.getLastRow(), 1);
    
    // Return empty array if only header row exists
    if (lastRow <= 1) {
      return [];
    }
    
    // Get all data rows
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 8);
    const values = dataRange.getValues();
    
    // Convert to array of objects
    return values.map(row => {
      return {
        TaskID: row[COLUMNS.TaskID],
        Title: row[COLUMNS.Title],
        DueDate: formatDate(row[COLUMNS.DueDate]),
        ReminderFrequency: row[COLUMNS.ReminderFrequency],
        Status: row[COLUMNS.Status],
        CreatedAt: formatDate(row[COLUMNS.CreatedAt]),
        LastReminderSent: row[COLUMNS.LastReminderSent] ? formatDate(row[COLUMNS.LastReminderSent]) : null,
        Priority: row[COLUMNS.Priority] || 'Medium'
      };
    }).filter(task => task.TaskID); // Filter out any empty rows
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw new Error('Failed to get tasks: ' + error.message);
  }
}

/**
 * Add a new task to the spreadsheet
 * @param {Object} taskData - Task data object
 * @return {Object} Response object with success status and message
 */
function addTask(taskData) {
  try {
    const sheet = initializeSpreadsheet();
    
    // Generate a unique task ID
    const taskId = Utilities.getUuid();
    
    // Create new row with task data
    const newRow = [
      taskId,
      taskData.Title,
      new Date(taskData.DueDate),
      taskData.ReminderFrequency,
      'Pending', // Default status for new tasks
      new Date(), // CreatedAt timestamp
      null, // LastReminderSent (null for new tasks)
      taskData.Priority || 'Medium'
    ];
    
    // Add row to sheet
    sheet.appendRow(newRow);
    
    return { success: true, message: 'Task added successfully' };
  } catch (error) {
    console.error('Error adding task:', error);
    return { success: false, message: 'Failed to add task: ' + error.message };
  }
}

/**
 * Edit an existing task in the spreadsheet
 * @param {Object} taskData - Task data object with TaskID
 * @return {Object} Response object with success status and message
 */
function editTask(taskData) {
  try {
    const sheet = initializeSpreadsheet();
    const taskId = taskData.TaskID;
    
    // Find row index for the task
    const lastRow = sheet.getLastRow();
    const taskIds = sheet.getRange(2, COLUMNS.TaskID + 1, lastRow - 1, 1).getValues();
    const rowIndex = taskIds.findIndex(row => row[0] === taskId);
    
    if (rowIndex === -1) {
      return { success: false, message: 'Task not found' };
    }
    
    // Get current row data
    const actualRowIndex = rowIndex + 2; // Adjust for header row and 0-based index
    const currentRowData = sheet.getRange(actualRowIndex, 1, 1, 8).getValues()[0];
    
    // Update row data
    const updatedRowData = [
      taskId, // TaskID (unchanged)
      taskData.Title,
      new Date(taskData.DueDate),
      taskData.ReminderFrequency,
      taskData.Status,
      new Date(currentRowData[COLUMNS.CreatedAt]), // CreatedAt (unchanged)
      currentRowData[COLUMNS.LastReminderSent], // LastReminderSent (unchanged)
      taskData.Priority || 'Medium'
    ];
    
    // Update row in sheet
    sheet.getRange(actualRowIndex, 1, 1, 8).setValues([updatedRowData]);
    
    return { success: true, message: 'Task updated successfully' };
  } catch (error) {
    console.error('Error editing task:', error);
    return { success: false, message: 'Failed to edit task: ' + error.message };
  }
}

/**
 * Delete a task from the spreadsheet
 * @param {string} taskId - The ID of the task to delete
 * @return {Object} Response object with success status and message
 */
function deleteTask(taskId) {
  try {
    const sheet = initializeSpreadsheet();
    
    // Find row index for the task
    const lastRow = sheet.getLastRow();
    const taskIds = sheet.getRange(2, COLUMNS.TaskID + 1, lastRow - 1, 1).getValues();
    const rowIndex = taskIds.findIndex(row => row[0] === taskId);
    
    if (rowIndex === -1) {
      return { success: false, message: 'Task not found' };
    }
    
    // Delete the row
    const actualRowIndex = rowIndex + 2; // Adjust for header row and 0-based index
    sheet.deleteRow(actualRowIndex);
    
    return { success: true, message: 'Task deleted successfully' };
  } catch (error) {
    console.error('Error deleting task:', error);
    return { success: false, message: 'Failed to delete task: ' + error.message };
  }
}

/**
 * Send email reminders for tasks based on reminder frequency
 * This function should be set up as a time-driven trigger
 */
function sendReminders() {
  try {
    const sheet = initializeSpreadsheet();
    const tasks = getTasks();
    const now = new Date();
    let remindersSent = 0;
    
    // Process each task
    tasks.forEach(task => {
      // Skip completed tasks or tasks with no reminder
      if (task.Status === 'Completed' || task.ReminderFrequency === 'None') {
        return;
      }
      
      // Check if reminder should be sent
      if (shouldSendReminder(task, now)) {
        // Send reminder email
        sendReminderEmail(task);
        
        // Update LastReminderSent timestamp
        updateLastReminderSent(task.TaskID, now);
        
        remindersSent++;
      }
    });
    
    console.log(`Sent ${remindersSent} reminders`);
  } catch (error) {
    console.error('Error sending reminders:', error);
  }
}

/**
 * Determine if a reminder should be sent for a task
 * @param {Object} task - Task object
 * @param {Date} now - Current timestamp
 * @return {boolean} True if reminder should be sent
 */
function shouldSendReminder(task, now) {
  // Get the reference date (last reminder sent or created date)
  const referenceDate = task.LastReminderSent 
    ? new Date(task.LastReminderSent) 
    : new Date(task.CreatedAt);
  
  // Calculate days since reference date
  const daysSinceReference = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
  
  // Check against reminder frequency
  switch (task.ReminderFrequency) {
    case 'Daily':
      return daysSinceReference >= 1;
    case 'Every 3 days':
      return daysSinceReference >= 3;
    case 'Every 5 days':
      return daysSinceReference >= 5;
    case 'Weekly':
      return daysSinceReference >= 7;
    case 'Bi-Weekly':
      return daysSinceReference >= 14;
    default:
      return false;
  }
}

/**
 * Send a reminder email for a task
 * @param {Object} task - Task object
 */
function sendReminderEmail(task) {
  const userEmail = Session.getActiveUser().getEmail();
  const dueDate = new Date(task.DueDate);
  
  // Format due date for display
  const formattedDueDate = Utilities.formatDate(
    dueDate, 
    Session.getScriptTimeZone(), 
    'EEE, MMM d, yyyy'
  );
  
  // Check if task is overdue
  const now = new Date();
  const isOverdue = dueDate < now;
  
  // Create email subject
  const subject = isOverdue 
    ? `🚨 OVERDUE: Task "${task.Title}" was due on ${formattedDueDate}`
    : `⏰ Reminder: Task "${task.Title}" is due on ${formattedDueDate}`;
  
  // Create email body
  let body = `
    <h2 style="color: ${isOverdue ? '#e74c3c' : '#3498db'};">
      ${isOverdue ? 'Overdue Task Alert' : 'Task Reminder'}
    </h2>
    
    <p>This is a reminder about the following task:</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #2c3e50;">${task.Title}</h3>
      <p><strong>Due Date:</strong> ${formattedDueDate} ${isOverdue ? '<span style="color: #e74c3c;">(OVERDUE)</span>' : ''}</p>
      <p><strong>Status:</strong> ${task.Status}</p>
      <p><strong>Priority:</strong> ${task.Priority}</p>
    </div>
    
    <p>Please update the status of this task in your TaskMaster application.</p>
    
    <p style="color: #7f8c8d; font-size: 0.8em;">
      This is an automated reminder sent from the TaskMaster application.
    </p>
  `;
  
  // Send the email
  MailApp.sendEmail({
    to: userEmail,
    subject: subject,
    htmlBody: body
  });
}

/**
 * Update the LastReminderSent timestamp for a task
 * @param {string} taskId - The ID of the task
 * @param {Date} timestamp - The timestamp to set
 */
function updateLastReminderSent(taskId, timestamp) {
  const sheet = initializeSpreadsheet();
  
  // Find row index for the task
  const lastRow = sheet.getLastRow();
  const taskIds = sheet.getRange(2, COLUMNS.TaskID + 1, lastRow - 1, 1).getValues();
  const rowIndex = taskIds.findIndex(row => row[0] === taskId);
  
  if (rowIndex === -1) {
    return;
  }
  
  // Update LastReminderSent timestamp
  const actualRowIndex = rowIndex + 2; // Adjust for header row and 0-based index
  sheet.getRange(actualRowIndex, COLUMNS.LastReminderSent + 1).setValue(timestamp);
}

/**
 * Format a date for JSON serialization
 * @param {Date} date - Date object
 * @return {string} ISO formatted date string
 */
function formatDate(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

/**
 * Get script URL for frontend
 * @return {string} The deployed URL of the script
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Create time-driven trigger for sending reminders
 * This should be run manually to set up the trigger
 */
function createReminderTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create a new daily trigger
  ScriptApp.newTrigger('sendReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9) // 9 AM
    .create();
  
  return 'Reminder trigger created successfully. Reminders will be sent daily at 9 AM.';
}

/**
 * Setup function to initialize the application
 * Run this function manually when setting up the application
 */
function setupApplication() {
  // Initialize spreadsheet
  const sheet = initializeSpreadsheet();
  
  // Create reminder trigger
  createReminderTrigger();
  
  return 'Application setup complete. Spreadsheet initialized and reminder trigger created.';
}
