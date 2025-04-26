from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
import uuid
import json

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///tasks.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# Task model
class Task(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(100), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    reminder_frequency = db.Column(db.String(20), nullable=False, default="None")
    status = db.Column(db.String(20), nullable=False, default="Pending")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_reminder_sent = db.Column(db.DateTime, nullable=True)
    priority = db.Column(db.String(10), nullable=False, default="Medium")

    def to_dict(self):
        return {
            "TaskID": self.id,
            "Title": self.title,
            "DueDate": self.due_date.strftime("%Y-%m-%d") if self.due_date else None,
            "ReminderFrequency": self.reminder_frequency,
            "Status": self.status,
            "CreatedAt": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "LastReminderSent": self.last_reminder_sent.strftime("%Y-%m-%d %H:%M:%S") if self.last_reminder_sent else None,
            "Priority": self.priority
        }

# Create the database tables
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/api/tasks', methods=['POST'])
def add_task():
    try:
        data = request.get_json()
        
        # Convert due_date string to date object
        due_date = datetime.strptime(data.get('DueDate'), "%Y-%m-%d").date()
        
        task = Task(
            title=data.get('Title'),
            due_date=due_date,
            reminder_frequency=data.get('ReminderFrequency', 'None'),
            status="Pending",  # Default for new tasks
            priority=data.get('Priority', 'Medium')
        )
        
        db.session.add(task)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Task added successfully"
        })
    except Exception as e:
        print(f"Error adding task: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to add task: {str(e)}"
        })

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def edit_task(task_id):
    try:
        task = Task.query.get(task_id)
        
        if not task:
            return jsonify({
                "success": False,
                "message": "Task not found"
            })
        
        data = request.get_json()
        
        # Convert due_date string to date object
        due_date = datetime.strptime(data.get('DueDate'), "%Y-%m-%d").date()
        
        task.title = data.get('Title')
        task.due_date = due_date
        task.reminder_frequency = data.get('ReminderFrequency')
        task.status = data.get('Status')
        task.priority = data.get('Priority', 'Medium')
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Task updated successfully"
        })
    except Exception as e:
        print(f"Error editing task: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to edit task: {str(e)}"
        })

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        task = Task.query.get(task_id)
        
        if not task:
            return jsonify({
                "success": False,
                "message": "Task not found"
            })
        
        db.session.delete(task)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Task deleted successfully"
        })
    except Exception as e:
        print(f"Error deleting task: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to delete task: {str(e)}"
        })

@app.route('/api/tasks/<task_id>/complete', methods=['PUT'])
def complete_task(task_id):
    try:
        task = Task.query.get(task_id)
        
        if not task:
            return jsonify({
                "success": False,
                "message": "Task not found"
            })
        
        task.status = "Completed"
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Task marked as completed"
        })
    except Exception as e:
        print(f"Error completing task: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to complete task: {str(e)}"
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)