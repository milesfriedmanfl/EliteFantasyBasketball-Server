<script>
    export let highestStatInWeekRecordsAsJSON = '{}';

    const fallbackImageUrl = 'https://image.emojipng.com/938/10482938.jpg';
    const highestStatInWeekRecords = JSON.parse(highestStatInWeekRecordsAsJSON);
</script>

<div class="background">
    <table>
        <tr>
            <th class="header table-cell">Category</th>
            <th class="header table-cell">Record Holder</th>
            <th class="header table-cell">Record</th>
            <th class="header table-cell">Week Recorded</th>
        </tr>
        {#each highestStatInWeekRecords as { category, recordTotal, recordHolderName, recordHolderImage, weekRecorded }}
            <tr>
                <td class="table-cell category">{category}</td>
                <td class="table-cell">
                    <div class="flex-row">
                        <img  class="team-icon" src="{recordHolderImage}" alt="{fallbackImageUrl}"/>
                        <span class="team-name">{recordHolderName}</span>
                    </div>
                </td>
                <td class="record-or-week table-cell">{recordTotal}</td>
                <td class="record-or-week table-cell">{weekRecorded}</td>
            </tr>
        {/each}
    </table>
</div>

<style>
    table {
        width: 100%;
    }
    .table-cell {
        padding-top: 20px;
        padding-bottom: 20px;
        border-bottom: 1px dashed floralwhite;
    }
    .background {
        background-color: #2f3136;
        border: 1px solid #2f3136;
        height: 100%;
        padding: 10px;
    }
    .flex-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }
    .header {
        color: floralwhite;
        font-size: 16px;
    }
    .category {
        color: #f6f0c1;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
    }
    .team-icon {
        border: 1px solid #856643;
        border-radius: 50%;
        height: 32px;
        width: 32px;
        margin-right: 20px;
    }
    .team-name {
        color: #a88c61;
        font-size: 16px;
        font-weight: bold;
        padding-left: 10px;
        padding-right: 10px;
    }
    .record-or-week {
        color: #f6f0c1;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
    }
</style>