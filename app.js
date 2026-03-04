const API_URL = 'http://localhost:3000/notes';
const ITEMS_PER_PAGE = 6;

let notes = [];
let currentPage = 1;
let hasMore = true;
let isLoading = false;
let searchTerm = '';
let selectedCategory = '';
let editingId = null;
let deleteId = null;

let searchController = null;
let notesController = null;

const notesList = document.getElementById('notesList');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const noteForm = document.getElementById('noteForm');
const formTitle = document.getElementById('formTitle');
const noteId = document.getElementById('noteId');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const categoryInput = document.getElementById('category');
const imageInput = document.getElementById('image');
const submitBtn = document.getElementById('submitBtn');
const cancelEdit = document.getElementById('cancelEdit');
const notesCount = document.getElementById('notesCount');
const lastUpdate = document.getElementById('lastUpdate');
const searchSpinner = document.getElementById('searchSpinner');
const confirmModal = document.getElementById('confirmModal');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');
const infiniteScrollTrigger = document.getElementById('infiniteScrollTrigger');
const notificationContainer = document.getElementById('notificationContainer');

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function validateForm() {
    let isValid = true;
    
    document.getElementById('titleError').textContent = '';
    document.getElementById('contentError').textContent = '';
    
    if (!titleInput.value.trim()) {
        document.getElementById('titleError').textContent = 'Заголовок обязателен';
        isValid = false;
    } else if (titleInput.value.length > 100) {
        document.getElementById('titleError').textContent = 'Заголовок не может быть длиннее 100 символов';
        isValid = false;
    }
    
    if (!contentInput.value.trim()) {
        document.getElementById('contentError').textContent = 'Содержание обязательно';
        isValid = false;
    } else if (contentInput.value.length > 1000) {
        document.getElementById('contentError').textContent = 'Содержание не может быть длиннее 1000 символов';
        isValid = false;
    }
    
    return isValid;
}

function ensureArray(data) {
    if (Array.isArray(data)) {
        return data;
    } else if (data && typeof data === 'object') {
        if (Array.isArray(data.notes)) {
            return data.notes;
        }
        const arrayProps = Object.values(data).filter(val => Array.isArray(val));
        if (arrayProps.length > 0) {
            return arrayProps[0];
        }
    }
    return [];
}

async function loadNotes(reset = false) {
    if (isLoading) return;
    
    if (reset) {
        currentPage = 1;
        notes = [];
        hasMore = true;
        notesList.innerHTML = '';
    }
    
    if (!hasMore && !reset) return;
    
    isLoading = true;
    
    if (notesController) {
        notesController.abort();
    }
    
    notesController = new AbortController();
    
    try {
        loadingIndicator.style.display = 'block';
        errorContainer.style.display = 'none';
        
        let url;
        if (searchTerm || selectedCategory) {
            const params = new URLSearchParams();
            if (searchTerm) {
                params.append('q', searchTerm);
            }
            if (selectedCategory) {
                params.append('category', selectedCategory);
            }
            url = `${API_URL}?${params}`;
        } else {
            const params = new URLSearchParams({
                _page: currentPage,
                _limit: ITEMS_PER_PAGE,
                _sort: 'id',
                _order: 'desc'
            });
            url = `${API_URL}?${params}`;
        }
        
        const response = await fetch(url, {
            signal: notesController.signal
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки заметок');
        }
        
        let data = await response.json();
        data = ensureArray(data);
        
        const totalCount = response.headers.get('X-Total-Count');
        
        if (reset) {
            notes = data;
        } else {
            notes = [...notes, ...data];
        }
        
        if (totalCount) {
            hasMore = notes.length < parseInt(totalCount);
        } else {
            hasMore = data.length === ITEMS_PER_PAGE;
        }
        
        if (!searchTerm && !selectedCategory) {
            currentPage++;
        }
        
        renderNotes();
        updateStats();
        
        if (hasMore && !searchTerm && !selectedCategory) {
            setupInfiniteScroll();
        } else {
            infiniteScrollTrigger.style.display = 'none';
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Запрос отменен');
        } else {
            errorMessage.textContent = error.message;
            errorContainer.style.display = 'block';
            showNotification(error.message, 'error');
        }
    } finally {
        isLoading = false;
        loadingIndicator.style.display = 'none';
        notesController = null;
    }
}

function renderNotes() {
    if (notes.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state">
                <p>Здесь пока нет заметок</p>
                <small>Создайте первую заметку с помощью формы слева</small>
            </div>
        `;
        return;
    }
    
    const notesHtml = notes.map(note => `
        <div class="note-card" data-id="${note.id}">
            <div class="note-header">
                <h3 class="note-title">${escapeHtml(note.title)}</h3>
                <span class="note-category">${escapeHtml(note.category || 'Без категории')}</span>
            </div>
            <div class="note-content">
                ${escapeHtml(note.content).substring(0, 150)}${note.content.length > 150 ? '...' : ''}
            </div>
            ${note.image ? `<img src="${note.image}" alt="Изображение" class="note-image">` : ''}
            <div class="note-footer">
                <span>${new Date(note.createdAt || Date.now()).toLocaleDateString()}</span>
                <div class="note-actions">
                    <button class="btn-icon edit" onclick="editNote('${note.id}')" title="Редактировать">✏️</button>
                    <button class="btn-icon delete" onclick="showDeleteConfirm('${note.id}')" title="Удалить">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    if (currentPage === 1 || notesList.innerHTML.includes('empty-state')) {
        notesList.innerHTML = notesHtml;
    } else {
        notesList.insertAdjacentHTML('beforeend', notesHtml);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    notesCount.textContent = `Всего заметок: ${notes.length}`;
    lastUpdate.textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
}

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchSpinner.style.display = 'inline-block';
    
    searchTimeout = setTimeout(() => {
        searchTerm = e.target.value;
        loadNotes(true);
        searchSpinner.style.display = 'none';
    }, 500);
});

categoryFilter.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    loadNotes(true);
});

noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const formData = new FormData();
    formData.append('title', titleInput.value.trim());
    formData.append('content', contentInput.value.trim());
    formData.append('category', categoryInput.value);
    formData.append('createdAt', new Date().toISOString());
    
    if (imageInput.files[0]) {
        if (imageInput.files[0].size > 2 * 1024 * 1024) {
            showNotification('Изображение не должно превышать 2MB', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            formData.append('image', e.target.result);
            await submitNote(formData);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        await submitNote(formData);
    }
});

async function submitNote(formData) {
    try {
        const noteData = {
            title: formData.get('title'),
            content: formData.get('content'),
            category: formData.get('category'),
            createdAt: formData.get('createdAt')
        };
        
        if (formData.get('image')) {
            noteData.image = formData.get('image');
        }
        
        const url = editingId ? `${API_URL}/${editingId}` : API_URL;
        const method = editingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteData)
        });
        
        if (!response.ok) {
            throw new Error('Ошибка сохранения заметки');
        }
        
        showNotification(
            editingId ? 'Заметка обновлена' : 'Заметка создана',
            'success'
        );
        
        resetForm();
        loadNotes(true);
        
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

window.editNote = function(id) {
    const note = notes.find(n => n.id == id);
    if (!note) return;
    
    editingId = id;
    formTitle.textContent = 'Редактирование заметки';
    noteId.value = note.id;
    titleInput.value = note.title;
    contentInput.value = note.content;
    categoryInput.value = note.category || 'Личное';
    submitBtn.textContent = 'Обновить';
    cancelEdit.style.display = 'inline-block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetForm() {
    editingId = null;
    formTitle.textContent = 'Новая заметка';
    noteId.value = '';
    titleInput.value = '';
    contentInput.value = '';
    categoryInput.value = 'Личное';
    imageInput.value = '';
    submitBtn.textContent = 'Сохранить';
    cancelEdit.style.display = 'none';
    
    document.getElementById('titleError').textContent = '';
    document.getElementById('contentError').textContent = '';
}

cancelEdit.addEventListener('click', resetForm);

window.showDeleteConfirm = function(id) {
    deleteId = id;
    confirmModal.style.display = 'flex';
};

confirmDelete.addEventListener('click', async () => {
    if (!deleteId) return;
    
    try {
        const response = await fetch(`${API_URL}/${deleteId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления заметки');
        }
        
        showNotification('Заметка удалена', 'success');
        loadNotes(true);
        
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        confirmModal.style.display = 'none';
        deleteId = null;
    }
});

cancelDelete.addEventListener('click', () => {
    confirmModal.style.display = 'none';
    deleteId = null;
});

function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && hasMore && !isLoading) {
                loadNotes();
            }
        });
    });
    
    if (infiniteScrollTrigger) {
        observer.observe(infiniteScrollTrigger);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadNotes();
});

window.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        confirmModal.style.display = 'none';
        deleteId = null;
    }
});