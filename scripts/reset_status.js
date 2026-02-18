const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function resetAllToNew() {
    try {
        console.log('Fetching all people...');
        const listRes = await fetch('http://localhost:3000/api/people');
        const listData = await listRes.json();

        if (!listData.success || !Array.isArray(listData.people)) {
            console.error('Failed to fetch people:', listData);
            return;
        }

        const people = listData.people;
        console.log(`Found ${people.length} people. Resetting status to "new"...`);

        for (const person of people) {
            if (!person.email) continue;

            console.log(`Resetting ${person.firstName} ${person.lastName} (${person.email})...`);

            const updateRes = await fetch('http://localhost:3000/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_status',
                    email: person.email,
                    status: 'new',
                    updatedBy: 'Reset Script'
                })
            });

            const updateData = await updateRes.json();
            if (!updateRes.ok || !updateData.success) {
                console.error(`Failed to update ${person.email}:`, updateData);
            } else {
                console.log(`Successfully updated ${person.email}`);
            }

            await new Promise(r => setTimeout(r, 200));
        }

        console.log('Done!');
    } catch (err) {
        console.error('Error in reset script:', err);
    }
}

resetAllToNew();
