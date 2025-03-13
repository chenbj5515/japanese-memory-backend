import { prisma } from "../services/prisma";

export async function checkSubscription(userId: string): Promise<boolean> {
    const userSubscription = await prisma.user_subscription.findFirst({
        where: {
            user_id: userId,
        },
        select: {
            end_time: true,
        },
    });

    if (!userSubscription) {
        return false;
    }

    const currentTime = new Date();
    const isValid = userSubscription.end_time > currentTime;

    return isValid;
}
