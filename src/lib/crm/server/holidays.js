import { findMany, findById, create, update, remove, readCollection } from './fileStore.js';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION = 'holidays';

export async function getHolidaysByContact(contactId) {
    return await findMany(COLLECTION, h => h.contactId === contactId);
}

export async function addHoliday(holidayData) {
    const holiday = {
        id: uuidv4(),
        ...holidayData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    return await create(COLLECTION, holiday);
}

export async function updateHoliday(id, holidayData) {
    const existing = await findById(COLLECTION, id);
    if (!existing) throw new Error('Holiday not found');
    
    const updated = {
        ...existing,
        ...holidayData,
        updatedAt: new Date().toISOString()
    };
    return await update(COLLECTION, id, updated);
}

export async function deleteHoliday(id) {
    return await remove(COLLECTION, id);
}

export async function checkHolidayConflict(contactId, start, end) {
    const holidays = await getHolidaysByContact(contactId);
    const checkStart = new Date(start);
    const checkEnd = new Date(end);

    return holidays.some(h => {
        const hStart = new Date(h.startDate);
        const hEnd = new Date(h.endDate);
        return (checkStart < hEnd && checkEnd > hStart);
    });
}
